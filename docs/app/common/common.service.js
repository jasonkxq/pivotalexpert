(function() {

    angular
    .module('app.common', [])
    .factory('commonService', commonService);
	
  
  // Initialize Firebase
  var config = {
    apiKey: "AIzaSyDt22-VriobDs7cNfkmY8yxHur9IQBewWo",
    authDomain: "pivotal-expert.firebaseapp.com",
    databaseURL: "https://pivotal-expert.firebaseio.com",
    storageBucket: "firebase-pivotal-expert.appspot.com",
    messagingSenderId: "841641391530"
  };
  
  //Replace with your login google account email
  var adminEmail = "cboesch@smu.edu.sg";
  
  //Replace with the name of your course
  var courseName = "Pivotal Expert";
  
  firebase.initializeApp(config);
  
  function commonService($mdToast,$mdDialog) {

	var service = {
      getAdminEmail: getAdminEmail,
      getCouseName:getCouseName,
      guid: guid,
      showSimpleToast:showSimpleToast
    };
    
    
	var last = {
        bottom: true,
        top: false,
        left: false,
        right: true
      };

    var toastPosition = angular.extend({},last);

	return service;

    function getAdminEmail() {
      return adminEmail;
    }
    
    function getCouseName() {
      return courseName;
    }
    
    function guid() {
      function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
      }
      return s4() + s4() + s4() + s4();
    }
   
    function getToastPosition(){
      sanitizePosition();

      return Object.keys(toastPosition)
        .filter(function(pos) { return toastPosition[pos]; })
        .join(' ');
    };

    function sanitizePosition() {
      var current = toastPosition;

      if ( current.bottom && last.top ) current.top = false;
      if ( current.top && last.bottom ) current.bottom = false;
      if ( current.right && last.left ) current.left = false;
      if ( current.left && last.right ) current.right = false;

      last = angular.extend({},current);
    }

    function showSimpleToast(msg) {
      var pinTo = getToastPosition();

      $mdToast.show(
        $mdToast.simple()
          .textContent(msg)
          .position(pinTo)
          .hideDelay(3000)
      );
    };

    
  }

})();