(function() {

  angular
    .module('app.lesson')
    .controller('LessonController', LessonController);

  function LessonController($q, $scope,$mdDialog, $routeParams, $location, $firebaseObject, $sce, $mdToast, navBarService, commonService) {

    console.log("LessonController");

	var ref = firebase.database().ref();
    var user = firebase.auth().currentUser;
	var chapter = $routeParams.chapter;
    var bid = $routeParams.bid;
	var qns = $routeParams.qns;
    var qid = $routeParams.qid;

	navBarService.updateNavBar();

	$scope.answer = "";
    function showCompleteDialog(msg) {
      var confirm = $mdDialog.confirm()
          .title('Challenge Completed!')
          .textContent(msg)
          .ok('Next Challenge');

        $mdDialog.show(confirm).then(function() {
            //track users who have completed and/or revisit and recording timing
            recordUserWhoCompletedOrRevisit().then(function(){
              nextQns(chapter,qns,question);
              navBarService.updateNavBar();
            });

        });
    }
    //Load Question
    var question = $firebaseObject(ref.child('course/questions/' + qid));
    question.$loaded().then(function(){
        //update user last attempt
        recordUserFirstLoadedTime();

        user = firebase.auth().currentUser;
        ref.child('userProfiles').child(user.uid).child('lastAttempt').set(qid);

        //retrieve qns details
        $scope.qnsTitle = question.qnsTitle;
		$scope.qnsInstruction = question.qnsInstruction;
		$scope.qnsDescription = question.qnsDescription;
        $scope.qnsHint = question.hint;
        var qnsType = question.qnsType;

        //Video type question
        if(qnsType == 'video'){
            //$scope.srclink = $sce.trustAsResourceUrl(question.link);
            var player;
            $scope.completed = false;
            loadPlayer();

            function loadPlayer(){
              if (typeof(YT) == 'undefined' || typeof(YT.Player) == 'undefined') {
                var tag = document.createElement('script');
                tag.src = "https://www.youtube.com/iframe_api";
                var firstScriptTag = document.getElementsByTagName('script')[0];
                firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
                window.onYouTubeIframeAPIReady = function() {
                  onYouTubePlayer();
                };

              } else {
                onYouTubePlayer();
              }
            }

            function onYouTubePlayer() {
              player = new YT.Player('player', {
                videoId: question.link,
                events: {
                  'onStateChange': onPlayerStateChange
                }
              });
            }


            function onPlayerStateChange(event) {
              if(event.data === 0) {
                $scope.completed = true;
                $scope.$apply();
                //showCompleteDialog("Time to applied what you have learnt!");
              }
            }

        }

        //IForm type question
        if(qnsType == 'iframe'){
            $scope.srclink = $sce.trustAsResourceUrl(question.link);
        }


        //Google Form type question
        if(qnsType == 'form'){
            $scope.srclink = $sce.trustAsResourceUrl(question.link);
            var initLoad = true;

            var iframeElem = document.getElementById('iframeId');
            iframeElem.onload  = function(){
                if(initLoad) {
                    initLoad = false;
                } else {
                    showCompleteDialog("You have completed the Challenge, go for more!");
                }
            };

        }
        //Slides type question
        if(qnsType == 'slides'){
           var slides = question.slides;

            $scope.currentSlide = 1;
            $scope.totalSlide = slides.length

            $scope.changeSlide = function(changeBy) {
                $scope.currentSlide += changeBy;
                var currentSlide = slides[$scope.currentSlide - 1];
                $scope.srclink = $sce.trustAsResourceUrl(currentSlide.imageLink);
                $scope.explanation = currentSlide.explanation;
            }
            //initial run
            $scope.changeSlide(0);
        }

        //MCQ type question
        if(qnsType == 'mcq') {
            $scope.questions = question.mcq;
            $scope.currentScore = 0;
            $scope.totalScore = $scope.questions.length;

            var mcq = question.mcq;

            $scope.currentMCQ = 1;
            $scope.totalMCQ = mcq.length
            var answerKey = $firebaseObject(ref.child('answerKey/' + qid));

            //MCQ validation
            $scope.changeMCQ = function(changeBy) {
               answerKey.$loaded().then(function() {
                   if($scope.questions[$scope.currentMCQ-1].qnsID === answerKey.answer[$scope.currentMCQ-1]) {
                        if($scope.currentMCQ === $scope.totalMCQ) {
                           showCompleteDialog("You have completed the Challenge, go for more!");
                        }else {
                            $scope.currentMCQ += changeBy;
                            $scope.mcq = mcq[$scope.currentMCQ - 1];
                        }
                    }else {
                        angular.forEach($scope.questions, function (qns, key) {
                            qns.qnsID = "";
                        });

                        $scope.mcq = mcq[0];
                        $scope.currentMCQ = 1;
                        $mdToast.show({
                            template: '<md-toast class="md-top">' +
                              '<div class="md-toast-content">' +
                                '<i style="color:red" class="fa fa-times-circle" aria-hidden="true"></i> ' +
                                '&nbsp&nbsp&nbspIncorrect. Re-attempt the challenge!' +
                              '</div>' +
                            '</md-toast>',
                            hideDelay: 3000
                        });

                    }
               });
            }

            //initial run
            $scope.mcq = mcq[0];
        }

        //Excel type question
        if (qnsType == 'excel') {
            //load qns sheet ID
            $scope.sheetID = question.sheetID;

            //load admin
            var adminID = $firebaseObject(ref.child('auth/admin/admin'));
            adminID.$loaded().then(function(){
                //load admin spreadsheetId
                var admin = $firebaseObject(ref.child('auth/admin/'));
                admin.$loaded().then(function(){
                    $scope.eduExcelID = admin.spreadsheetID;

                    //load user spreadsheetId
                    var currentUser = $firebaseObject(ref.child('auth/users/' + user.uid));
                    currentUser.$loaded().then(function(){

                        $scope.userExcelID = currentUser.driveExcel;
                        //$scope.userSheetID = currentUser.sheetID; //Currently not in use
                        $scope.token = currentUser.access_token;

                        gapi.auth.setToken({
                            access_token: $scope.token
                        });

                        var discoveryUrl = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
                        //Delete all sheet except for instruction

                        gapi.client.load(discoveryUrl).then(function() {
                            getAllSheets().then(function(result) {
                                deleteSheets(result).then(function(){
                                    copyQnsFromEdu().then(function(result) {
                                        updateSheetTitle().then(function(result) {
                                            var excelLink = "https://docs.google.com/spreadsheets/d/" + $scope.userExcelID + "/edit#gid=" + $scope.curSheet;
                                            $scope.srclink = $sce.trustAsResourceUrl(excelLink);
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        }

        //Codebox type question
        if(qnsType == 'code') {
            var editor = ace.edit("editor");

            editor.setTheme("ace/theme/chrome");
            editor.getSession().setMode("ace/mode/javascript");
            editor.setOption("maxLines", 30);
            editor.setOption("minLines", 10);

            var userAch = $firebaseObject(ref.child('userProfiles').child(user.uid).child('courseProgress').child(qid));

            userAch.$loaded().then(function(){
              if(userAch.userAnswer){
                  console.log(userAch.userAnswer);
                editor.insert(userAch.userAnswer);
              }else{
                   console.log("TESTING123");
                //insert code to codebox from firebase
                editor.insert(question.initialCode);
              }
            });



            /* Bind to commands
            editor.commands.addCommand({
                name: 'myCommand',
                bindKey: {win: 'Ctrl-Enter',  mac: 'Command-Enter'},
                exec: function(editor) {
                    alert("you have just press CTRL-ENTER")
                },
                readOnly: true // false if this command should not apply in readOnly mode
            });
            */
        }

        //Submit answer and go next qns if correct
        $scope.submit = function() {
            //track active user
            recordActiveUser();
            //track attempts and record user start time if first attempt
            recordUserAttempt();
            //track user who attempted
            recordUserWhoAttempted();


            $scope.checkingAns = true;
            //Load answer key of the question
            var answerKey = $firebaseObject(ref.child('answerKey/' + qid));
            answerKey.$loaded().then(function(){

                //video and slides question type
                if (qnsType == 'video' || qnsType == 'slides' || qnsType == 'iframe'){
                    showCompleteDialog("Time to applied what you have learnt!");
                }

                //mcq question type
                if (qnsType == 'mcq'){
                    $scope.checked = true;
                    $scope.currentScore = 0;
                    for (i = 0; i < $scope.totalScore; i++) {
                        var result = $scope.questions[i].qnsID == answerKey.answer[i];
                        $scope.questions[i].qnsID = result;
                        //increase score if correct
                        if(result) {
                            $scope.currentScore += 1;
                        }
                    }
                }

                //excel question type
                if (qnsType == 'excel') {
                    $scope.incorrect = false;
                    gapi.auth.setToken({
                        access_token: $scope.token
                    });

                    var discoveryUrl = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
                    gapi.client.load(discoveryUrl).then(function() {
                        $scope.sheetsToBeDelete = [];
                        $scope.qnsHint = [];
                        validateAns(answerKey.testcases).then(function(result){
                            deleteSheets($scope.sheetsToBeDelete);
                            if (result.indexOf(false) === -1) {
                                showCompleteDialog("AWESOME!! You have completed the Challenge, go for more!");
                                $scope.incorrect = false;
                                $scope.checkingAns = false;
                            } else {
                                $scope.incorrect = true;
                                $scope.checkingAns = false;
                            }
                        });
                    });
                }

                //code question type
                if (qnsType == 'code') {
                    // Check for syntax error
                    var editor = ace.edit("editor");
                    var annot = editor.getSession().getAnnotations();
                    if (annot.length == 0) {
                        var code = editor.getValue();
                        //console.log(code);
                        $scope.codeResult = [];
                        $scope.hints = [];
                        var errorHints =[];
                        var promises = []
                        var totalTestNum = answerKey.testcases.length;
                        var functionCode = answerKey.functionCode;

                        for (i = 0; i < totalTestNum; i++) {
                            var test =  answerKey.testcases[i];

                            //Run Test case
                            runTestcase(test, code, functionCode).then(function(result) {
                                $scope.codeResult.push(result);
                                //When end of test case
                                if($scope.codeResult.length === totalTestNum){
                                    $scope.checkingAns = false;
                                    if ($scope.codeResult.indexOf(false) === -1) {
                                        showCompleteDialog("FANTASTIC!! You have completed the Challenge, go for more!");
                                    } else {

                                        $scope.incorrect = true;
                                        var hint = "";
                                        for (a = 0; a < $scope.hints.length ; a++){
                                          var hintNo = a + 1;
                                          hint = hint + hintNo + " " + $scope.hints[a] + "\n\r";
                                        }
                                        $scope.qnsHint = hint;
                                    }
                                }
                            });
                        }

                    } else {
                        $scope.incorrect = true;
                        $scope.errMsg = "Error with the syntax. Please check your answer again."
                    }
                }
            });
        }
    });

    function validateAns(testcases) {
        var deferred = $q.defer();
        $scope.result = [];
        angular.forEach(testcases, function (value, key) {
            duplicateSheet(value).then(function(result) {
                $scope.result.push(result.result);
                if(!result.result) {
                    $scope.qnsHint.push(result.msg);
                }
                if($scope.result.length == testcases.length) {
                    deferred.resolve($scope.result);
                }
            });
        });

        return deferred.promise;
    }

    function getAllSheets() {
        var deferred = $q.defer();
        gapi.client.sheets.spreadsheets.get({
          spreadsheetId: $scope.userExcelID
        }).then(function(response) {
          var sheets = response.result.sheets;
          var sheetsToBeDelete = [];

          for (i = 0; i < sheets.length; i++) {
            var sheetId = sheets[i].properties.sheetId;
            if ( sheetId != 0) {
                sheetsToBeDelete.push(sheetId);
            }

            if(i == (sheets.length - 1)) {
                deferred.resolve(sheetsToBeDelete);
            }
          }
        });
        return deferred.promise;
    }

    function deleteSheets(sheetsToBeDelete) {
        var deferred = $q.defer();
        var sheets = sheetsToBeDelete;

        for (i = 0; i < sheets.length; i++) {
          var sheetId = sheets[i];
          if ( sheetId != 0) {
            gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: $scope.userExcelID,
                requests: [
                  {
                    deleteSheet:{
                      sheetId: sheetId
                    }
                  }
                ]
            }).then(function(response) {
                console.log("Sheet Deleted");
            });
          }
          if(i == (sheets.length - 1)) {
              deferred.resolve(true);
          }
        }
        if(sheets.length === 0) {
              deferred.resolve(true);
        }

        return deferred.promise;
    }

    function copyQnsFromEdu() {
        var deferred = $q.defer();
        gapi.client.sheets.spreadsheets.sheets.copyTo({
          spreadsheetId: $scope.eduExcelID,
          sheetId: $scope.sheetID,
          destinationSpreadsheetId: $scope.userExcelID,
        }).then(function(response) {

          $scope.curSheet = response.result.sheetId;
          deferred.resolve(true);

        });
        return deferred.promise;
    }

    function duplicateSheet(validation) {
        var deferred = $q.defer();

        gapi.client.sheets.spreadsheets.sheets.copyTo({
            spreadsheetId: $scope.userExcelID,
            sheetId: $scope.curSheet,
            destinationSpreadsheetId: $scope.userExcelID,
        }).then(function(response) {
            $scope.sheetsToBeDelete.push(response.result.sheetId);
            var sheetName = response.result.title;

            gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: $scope.userExcelID,
                range: sheetName + "!" + validation.cellToChange,
                valueInputOption: "USER_ENTERED",
                values:
                  [
                    [validation.changedTo]
                  ]
            }).then(function(response) {
                gapi.client.sheets.spreadsheets.values.get({
                    spreadsheetId: $scope.userExcelID,
                    range: sheetName + "!" + validation.expectCell
                }).then(function(response) {
                    if(response.result.values){
                        validation.result = response.result.values[0][0] == validation.toEqual;
                    } else {
                        validation.result = false;
                    }
                    deferred.resolve(validation);
                });
            });
        });
        return deferred.promise;
    }

    function updateSheetTitle() {
        var deferred = $q.defer();
        gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: $scope.userExcelID,
            requests: [
              {
                updateSheetProperties:{
                  properties:{
                    title: $scope.qnsTitle,
                    sheetId: $scope.curSheet
                  },
                  fields: "title"
                }
              }
            ]
          }).then(function(response) {
            deferred.resolve(true);
        });
        return deferred.promise;
    }

    function runTestcase(test, code, functionCode) {

        var deferred = $q.defer();
        var ww = new Worker(getInlineJSandTest(test, code, functionCode));
        //Send any message to worker
        ww.postMessage("and message");
        ww.onmessage = function (e) {
            var msg = e.data;
            //check if there failed result
            deferred.resolve(msg);
            if(msg == false){
              $scope.hints.push(test.hint);
            }
        };
        return deferred.promise;
    }

    function getInlineJSandTest (test, code,functionCode) {
		var top = 'onmessage = function(msg){';
		var bottom = 'postMessage(result);};';
    var newTest = "var result = " + test.expect + " == " + test.toEqual +";";
		var all = functionCode + code +"\n\n"+top+"\n"+newTest+"\n"+bottom+"\n"
    console.log(all);
		var blob = new Blob([all], {"type": "text\/plain"});
		return URL.createObjectURL(blob);
	}

    function nextQns(chapter, question, loadedQns){
        //track user who completed and/or revisit
        //recordUserWhoCompletedOrRevisit();

        //update course progress in firebase db
        var dateTimeNow = new Date().toLocaleString("en-US");
        var userAchievementRef = ref.child('userProfiles').child(user.uid).child('courseProgress').child(qid);
        console.log(loadedQns.qnsType);
        if (loadedQns.qnsType == 'code') {
          var editor = ace.edit("editor");
          var code = editor.getValue();
          userAchievementRef.update({ "completedAt": firebase.database.ServerValue.TIMESTAMP, "text": dateTimeNow, "userAnswer":code});
        }else{
          userAchievementRef.update({ "completedAt": firebase.database.ServerValue.TIMESTAMP, "text": dateTimeNow});
        }

        chapter = parseInt(chapter) - 1;
        question = parseInt(question);

        var courseSeq = $firebaseObject(ref.child('library').child(bid).child("sequence"));
        courseSeq.$loaded().then(function() {
            var nextQns = courseSeq[chapter].qns[question];
            if(nextQns) {
				$location.path('/lesson/' + nextQns.qnsType + '/' + bid + '/' + (chapter + 1) + '/' + (question + 1)+ '/' + nextQns.qid);
			} else {
				//Complete current chapter, go to next chapter
				nextQns = courseSeq[chapter+1];
				if(nextQns && courseSeq[chapter+1].qns) {
                    nextQns = courseSeq[chapter+1].qns[0];
					$location.path('/lesson/' + nextQns.qnsType + '/' + bid + '/' + (chapter + 2) + '/1/'+ nextQns.qid );
				} else {
					//update last attemp in firebase db
					ref.child('userProfiles').child(user.uid).child('lastAttempt').set("completed");
					//Complete whole course
					$location.path('/course/');
				}
			}

        });
    }

    //map the col alphabet to number
    function sheetColMapping(col) {
        mapping = {
            "A" : 1,
            "B" : 2,
            "C" : 3,
            "D" : 4,
            "E" : 5,
            "F" : 6,
            "G" : 7,
            "H" : 8,
            "I" : 9,
            "J" : 10,
            "K" : 11,
            "L" : 12,
            "M" : 13,
            "N" : 14,
            "O" : 15,
            "P" : 16,
            "Q" : 17,
            "R" : 18,
            "S" : 19,
            "T" : 20,
            "U" : 21,
            "V" : 22,
            "W" : 23,
            "X" : 24,
            "Y" : 25,
            "Z" : 26,
        }
        return mapping[col.toUpperCase()]
    }

    function recordActiveUser() {
        var preDateNow = new Date().toLocaleString("en-US");
        preDateNow = preDateNow.substring(0,preDateNow.indexOf(','));
        var preDateNow2 = preDateNow.replace('\/','');
        var dateNow = preDateNow2.replace('\/','');
        var activeUserAnalyticsRef = ref.child('analytics').child('activeUser').child(dateNow);
        var record = {};
        record[user.uid] = true;
        activeUserAnalyticsRef.update(record);
    }

    function recordUserAttempt() {
        var userAttemptRef = ref.child('analytics').child('challengeStats').child(qid);
        var userAttempt = $firebaseObject(userAttemptRef);
        userAttempt.$loaded().then(function(){
          var count;
          if(userAttempt.totalAttempts){
            count = userAttempt.totalAttempts + 1;
          }else{
            count = 1;
          }
          userAttemptRef.update({totalAttempts:count});
        });
    }

    function recordUserFirstLoadedTime(){
      var challengeRecordRef = ref.child('analytics').child('challengeStats').child(qid);
      var challengeRecord = $firebaseObject(challengeRecordRef);
      var userChallengeTimeRecordRef = ref.child('analytics').child('challengeStats').child(qid).child('userTimings');

      challengeRecord.$loaded().then(function(){
        var userId = user.uid;
        if(challengeRecord.userAttemptedRecords){
          if(!challengeRecord.userAttemptedRecords.hasOwnProperty(userId)){
            var record = {};
            var dateTimeAttempted = new Date().toLocaleString("en-US");
            record[userId] = {startTime:dateTimeAttempted};
            userChallengeTimeRecordRef.update(record);
          }
        }else{
          var record = {};
          var dateTimeAttempted = new Date().toLocaleString("en-US");
          record[userId] = {startTime:dateTimeAttempted};
          userChallengeTimeRecordRef.update(record);
        }
      });

    }

    function recordUserWhoAttempted() {
        var userAttemptedRecordRef = ref.child('analytics').child('challengeStats').child(qid).child('userAttemptedRecords');

        var record = {};
        record[user.uid] = true;
        userAttemptedRecordRef.update(record);
    }

    /*function recordUserWhoCompleted() {
        var userCompletedRecordRef = ref.child('analytics').child('challengeStats').child(qid).child('userCompletedRecords');
        var record = {};
        record[user.uid] = true;
        userCompletedRecordRef.update(record);
    }*/

    function recordUserWhoCompletedOrRevisit() {
        var q = $q.defer();
        var challengeRecordRef = ref.child('analytics').child('challengeStats').child(qid);
        var userCompletedRecordRef = ref.child('analytics').child('challengeStats').child(qid).child('userCompletedRecords');
        var userChallengeTimeRecordRef = ref.child('analytics').child('challengeStats').child(qid).child('userTimings').child(user.uid);
        var challengeRecord = $firebaseObject(challengeRecordRef);

        challengeRecord.$loaded().then(function(){
          var userId = user.uid;

          if(challengeRecord.userCompletedRecords){
            if(challengeRecord.userCompletedRecords[userId]){
              var revisitCount = challengeRecord.revisitRecords;
              if(revisitCount){
                revisitCount += 1;
              }else{
                revisitCount = 1;
              }
            challengeRecordRef.update({revisitRecords:revisitCount});
            }else{
              var record = {};
              record[user.uid] = true;
              userCompletedRecordRef.update(record);
              var firstEndDateTime = new Date();
              var firstEndDateTimeString = firstEndDateTime.toLocaleString("en-US");
              userChallengeTimeRecordRef.update({endTime:firstEndDateTimeString});
              var startTime = new Date(challengeRecord.userTimings[userId].startTime);
              var difference = firstEndDateTime.getTime() - startTime.getTime();
              if(challengeRecord.averageTime){
                var averageTime = challengeRecord.averageTime;
                var totalUsersCompleted = Object.keys(challengeRecord.userCompletedRecords).length;
                var newAverageTime = (averageTime * (totalUsersCompleted - 1) + difference)/totalUsersCompleted;
                challengeRecordRef.update({averageTime:newAverageTime});
              }else{
                challengeRecordRef.update({averageTime:difference});
              }
            }
          }else{
            var record = {};
            record[user.uid] = true;
            userCompletedRecordRef.update(record);
            var firstEndDateTime = new Date();
            var firstEndDateTimeString = firstEndDateTime.toLocaleString("en-US");
            userChallengeTimeRecordRef.update({endTime:firstEndDateTimeString});
            var startTime = new Date(challengeRecord.userTimings[userId].startTime);
            var difference = firstEndDateTime.getTime() - startTime.getTime();
            if(challengeRecord.averageTime){
              var averageTime = challengeRecord.averageTime;
              var totalUsersCompleted = Object.keys(challengeRecord.userCompletedRecords).length;
              var newAverageTime = (averageTime * (totalUsersCompleted - 1) + difference)/totalUsersCompleted;
              challengeRecordRef.update({averageTime:newAverageTime});
            }else{
              challengeRecordRef.update({averageTime:difference});
            }
          }
          q.resolve(true);
        });
        return q.promise;
    }

  };
})();
