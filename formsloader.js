var logger = require('winston');
logger.add(logger.transports.File, {filename: './logs/formsLoader.log'});
logger.remove(logger.transports.Console);
logger.level = 'debug';

logger.info("forms download process started");

var commandLineArgs = require('command-line-args');

var cli = commandLineArgs([
    {name: 'form', alias: 'f', type: String},
    {name: "offeringType", alias: 'o', type: String}
])

var options = cli.parse();
options.form = 'All';

var fs = require('fs');
var xml2js = require('xml2js');
var parseString = xml2js.parseString;
var async = require("async");
var MongoClient = require('mongodb').MongoClient;
// var ObjectId = require('mongodb').ObjectID;
var url = 'mongodb://localhost:27017/formD';

var loaderQueue = null;
var processStatus = null;
var successProcess = 0;
var failedProcess = 0;
var dbConnection = null;
var successCounter = 0;

var startFormsLoader = function () {

    // initialize mongo connection

    MongoClient.connect(url, function (err, db) {
        if (err) {
            logger.error("unable to initate conneciton to database", err);
        }
        else {
            console.log("connected to mongo");
            dbConnection = db;
            var collection = dbConnection.collection('forms');
            //collection.insert({"a":2}, {"w":1}, function(err, result) {console.log(err);console.log("insert");});

            // initalizing loader tasks queue
            loaderQueue = async.queue(loaderTask, 200);
            processStatus = setInterval(processingStatus, 5000);
            loaderQueue.drain = function () {
                if (processStatus) {
                    clearInterval(processStatus);
                }

                if (dbConnection) {
                    //dbConnection.close();
                }

                logger.info("all loader tasks been completed");
                logger.info("total loader succeded", successProcess);
                logger.info("total loader failiures", failedProcess);
                console.log("Processing completed");
                // process.exit(0);
            }

            // handel all forms method
            if (options.form == "All") {
                var formsList = fs.readdirSync("./forms");
                for (var formInd = 0; formInd < formsList.length; formInd++) {
                    var formUrl = "./forms/" + formsList[formInd];
                    if (formUrl != './forms/.DS_Store') {
                        loaderQueue.push({form: formUrl, offeringType: options.offeringType}, loaderTaskStatusHandler);
                    }
                }
            }
            // handel specfic form method
            else {
                var formUrl = "./forms/" + options.form;
                loaderQueue.push({form: formUrl, offeringType: options.offeringType}, loaderTaskStatusHandler);
            }
        }

    });
}

var processingStatus = function () {
    //print processing status
    logger.info("from loader progress, " + loaderQueue.running() + " active, " + loaderQueue.length() + " in queue");
}

var loaderTaskStatusHandler = function (err, form) {
    console.log("task complete");
    if (err) {
        failedProcess++;
    } else {
        successProcess++;
    }
}

var loaderTask = function (task, callback) {
    logger.info("start form loading for ", task.form);
    logger.info("start form loading for ", task.offeringType);


    // this.task = task;
    // this.callback = callback;
    // load form into memory
    var formData = fs.readFileSync(task.form, 'utf8');
    var edgarSubmissionXml = null;

    // pasre xml
    var edgarSubmissionStart = formData.indexOf("<edgarSubmission>");
    var edgarSubmissionEnd = formData.indexOf("</edgarSubmission>") + "</edgarSubmission>".length;

    edgarSubmissionXml = formData.slice(edgarSubmissionStart, edgarSubmissionEnd);

    //add reg d FILED AS OF DATE
    var dateStart = formData.indexOf("DATE AS OF CHANGE") + ("DATE AS OF CHANGE").length + 1;
    var dateEnd = formData.indexOf("EFFECTIVENESS DATE");

    var date = formData.slice(dateStart, dateEnd);

    date = date.replace(/\s+/g, '');

    //add reg d SEC ACT
    var SEC_ACTStart = formData.indexOf("SEC ACT") + ("SEC ACT").length + 1;
    ;
    var SEC_ACTEnd = formData.indexOf("SEC FILE NUMBER");

    var SEC_ACT = formData.slice(SEC_ACTStart, SEC_ACTEnd);

    SEC_ACT = SEC_ACT.replace(/\s+/g, '');


    //add reg d ACCESSION NUMBER
    var ACCESSIONStart = formData.indexOf("ACCESSION NUMBER") + ("ACCESSION NUMBER").length + 1;
    ;
    var ACCESSIONEnd = formData.indexOf("CONFORMED SUBMISSION TYPE");

    var ACCESSION = formData.slice(ACCESSIONStart, ACCESSIONEnd);

    ACCESSION = ACCESSION.replace(/\s+/g, '');


    parseString(edgarSubmissionXml, function (err, formObj) {
        logger.info("handleObject");
        if (err) {
            logger.info(err);
            callback(err);
            return;
        }
        var industryGroup = formObj.edgarSubmission.offeringData[0].industryGroup;
        var indType = industryGroup[0].industryGroupType[0];
        logger.info(indType);
        logger.info(task.offeringType);

        var collection = dbConnection.collection('forms');
        collection.insert({
            date: date,
            SEC_ACT: SEC_ACT,
            ACCESSION: ACCESSION,
            formObj: formObj.edgarSubmission
        }, function (err, result) {
            if (err) {
                console.log(err);
            }
            successCounter++;
            callback();
            console.log("insert instance " + result + '\n' + "already insert" + successCounter + "instances" + '\n');
        });


        /*		// check if the form industry type is off interst
         if (indType != task.offeringType) {
         // no interst move to the next one
         callback(null);
         }
         else {
         // hanlde form
         logger.info("match!!!")
         // logger.info(formData);
         // logger.info(edgarSubmissionXml);

         // verify that the form not been entered already, by validating the ACCESSION NUMBER
         var acNumber = extractAccessionNumber(formData);
         logger.info("Accession Number",acNumber);
         var collection = dbConnection.collection('forms');
         collection.findOne({"a" : 2},function(err, item) {
         console.log(err);
         if (err) {
         console.log("unable to count mongo - " + item);
         logger.error("Error count collection", err);
         callback(err);
         }
         else {
         console.log("item retrived" + item);
         if (count != 0) {
         logger.warn("forms with the same Accession Number already exists");
         callback(null);
         }
         else  {
         logger.info("AC is vailding building object to insert ot DB");
         }
         }
         })



         callback(null);
         }*/


        // 	var acInd = formData.indexOf("ACCESSION NUMBER");
        // 	var acEndInd = formData.indexOf("CONFORMED SUBMISSION TYPE") - 1;
        // 	var acStr = formData.slice(acInd,acEndInd);
        // 	console.log(acStr);
        // 	callback(null);


    });


    // create model for db loading
    // load to db
}


var extractAccessionNumber = function (formData) {
    var acInd = formData.indexOf("ACCESSION NUMBER");
    var acEndInd = formData.indexOf("CONFORMED SUBMISSION TYPE") - 1;
    var acStr = formData.slice(acInd, acEndInd);
    var acStr = acStr.replace(/\s\s+/g, '@@split@@');
    var acNumber = acStr.split("@@split@@")[1];

    return acNumber;
}


startFormsLoader();









