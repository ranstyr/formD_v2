var logger = require('winston');
logger.add(logger.transports.File, { filename: './logs/indexDownload.log' });
logger.remove(logger.transports.Console);
logger.level = 'info';


logger.info("formd index loading process");



var commandLineArgs = require('command-line-args');
var processStatus = null;
var cli = commandLineArgs([
  { name: 'startYear', alias: 's', type: Number },
  { name: 'endYear', alias: 'e', type: Number }
])

var options = cli.parse();
options.startYear = 2016.
options.endYear = 2016.


var JSFtp = require("jsftp");
var async = require("async"); 


var startYear = options.startYear || 2015;
var currentDate = new Date();
var endYear = options.endYear || currentDate.getFullYear();


var quarters = ["QTR1","QTR2","QTR3","QTR4"];


var queue = async.queue(function (task, callback) {    
    var ftp = new JSFtp({host: "ftp.sec.gov"});
    logger.info("downloading form index from sec FTP...")
    logger.info("index " + task.target);
    ftp.get(task.target, task.dest, function(hadErr) {
      var err = null;
      if (hadErr) {
        console.error('There was an error retrieving the file.');
        err = "error downloading " + task.target;
      }
      callback(err);   
    });
    
}, 1);

queue.drain = function() {
  
  if(processStatus) {
    clearInterval(processStatus);
  }
  logger.info("all files download been completed");
}


var setIndexFilesForProcess = function(){
  for (var year = startYear; year <= endYear; year++) {
    logger.info("start analyzing data for " + year);
    for (var qrtInd = 0;  qrtInd < quarters.length; qrtInd++) {
      var qrt = quarters[qrtInd];
      logger.info("start analyzing data for " + qrt);
      
      var currYear = year;
      queue.push(
        {
          target: '/edgar/full-index/'+currYear+'/'+qrt+'/form.idx',
          dest: './index/form'+currYear+quarters[qrtInd]+'.idx'
        }, function (err) {
          logger.info('finished processing file' + err);
      });      
    }
  }  
}

var processingStatus = function() {
  //print processing status
  logger.info("downloading index files in progress");
  logger.info(queue.running() + " active downloads");
  logger.info(queue.length() + " downloads in queue");
}

var start = function() {
  logger.info("retirving formD data for " + startYear + " to " +endYear);  
  setIndexFilesForProcess();
  processStatus = setInterval(processingStatus,1000);

}

start();
