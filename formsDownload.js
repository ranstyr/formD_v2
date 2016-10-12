var logger = require('winston');
logger.add(logger.transports.File, {filename: './logs/formsDownload.log'});
logger.remove(logger.transports.Console);
logger.level = 'debug';

logger.info("forms download process started");

var commandLineArgs = require('command-line-args');
var JSFtp = require("jsftp");
var async = require("async");
var fs = require('fs');

debugger;
var ftp = new JSFtp({host: "ftp.sec.gov", debugMode: true});
ftp.on('jsftp_debug', function (eventType, data) {
    logger.debug('DEBUG: ', eventType);
    logger.debug(JSON.stringify(data, null, 2));
});

var sucessDownload = 0;
var failedDownload = 0;
var processStatus = null;

var cli = commandLineArgs([
    {name: 'index', alias: 'i', type: String},
    {name: "formTypeId", alias: 'f', type: String}
])

var options = cli.parse();
options.index = 'All';
options.formTypeId = 'D';


var ftpQueue = async.queue(function (task, callback) {

    logger.info("downloading form", task.target);
    logger.debug("download target", task.target);
    logger.debug("download dest", task.dest);
    ftp.get(task.target, task.dest, function (hadErr) {
        var err = null;
        if (hadErr) {
            logger.error('There was an error retrieving the form from the fto server.', task.target);
            err = "error downloading " + task.target;
        }
        callback(err);
    });

}, 1);


var startIndexLoading = function () {

    if (options.index == "All") {
        var indexList = fs.readdirSync("./index");
        console.log(indexList);
        logger.info("index list", indexList);


        for (var indexInd = 0; indexInd < indexList.length; indexInd++) {
            console.log("processing " + indexList[indexInd]);
            var indexFile = "./index/" + indexList[indexInd];
            console.log(indexFile);
            parseIndex(indexFile, options.formTypeId, formHandler)

        }

    } else {
        parseIndex("./index/" + options.index, options.formTypeId, formHandler)

    }
    processStatus = setInterval(processingStatus, 10000);
}


var parseIndex = function (indexFile, formTypeId, handler) {
    var formCount = 0;
    var startingLine = 11;

    var LineByLineReader = require('line-by-line'),
        lr = new LineByLineReader(indexFile);

    var lineCount = 0;

    lr.on('error', function (err) {
        // 'err' contains error object
        logger.error("error reading index file " + err);
        console.log("error reading index file");
        process.exit(1);
    });

    lr.on('line', function (line) {
        lineCount++;
        if (lineCount >= startingLine) {
            var removeSpacesLine = line.replace(/\s\s+/g, '@@split@@');
            var formDetails = removeSpacesLine.split("@@split@@");
            var formType = formDetails[0];

            if (formType == formTypeId) {
                formCount++;
                handler(formDetails);
                // if(formCount >= 5) {
                // 	lr.pause();
                // }
            }
        }
    });

    lr.on('end', function () {
        // All lines are read, file is closed now.
        logger.info("completed reading index file");
        logger.info("processing for type ", formTypeId);
        logger.info("forms for processign ", formCount);
    });


}


ftpQueue.drain = function () {

    if (processStatus) {
        clearInterval(processStatus);
    }
    logger.info("all files download tasks been completed");
    logger.info("total files download succeded", sucessDownload);
    logger.info("total failiures", failedDownload);
    console.log("Processing completed");
    // process.exit(0);
}


var processingStatus = function () {
    //print processing status
    logger.info("from processing progress, " + ftpQueue.running() + " active, " + ftpQueue.length() + " in queue");
}
var formHandler = function (form) {
    logger.debug("Push form  " + form[2] + " to download queue");
    // logger.info(form);
    var targetURL = '/' + form[4];
    var targetFile = './forms/' + form[2] + '.form';
    ftpQueue.push({target: targetURL, dest: targetFile}, function (err, form) {
        // file download
        if (err) {
            logger.error("error from ftp on callback");

            failedDownload++;
        }
        else {
            sucessDownload++;

            // logger.info(form);
            //
            // var edgarSubmissionStart = form.indexOf("<edgarSubmission>");
            // var edgarSubmissionEnd = form.indexOf("</edgarSubmission>") + "</edgarSubmission>".length;

            // var edgarSubmissionXml = form.slice(edgarSubmissionStart,edgarSubmissionEnd);
            // // logger.info(edgarSubmissionXml);
            // parseString(edgarSubmissionXml, function(err,res){
            // 	if(err) {
            // 		logger.info(err);
            // 		return;
            // 	}

            // 	logger.info(res.edgarSubmission.offeringData[0].industryGroup);

            // });
        }
    });

}


startIndexLoading();