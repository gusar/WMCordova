var HOST = "http://109.255.105.224:8000";

var URLS = {
    get_station_data: "/rest/get_station_data/",
    login: "/rest/tokenlogin/",
    userme: "/rest/userme/",
    updateposition: "/rest/updateposition/",
    register: "/rest/signup/",
    signup: "/signup"
};

var map;

var curIcon = L.ExtraMarkers.icon({
    icon: 'fa-user-circle-o',
    iconColor: 'white',
    markerColor: 'blue',
    shape: 'square',
    prefix: 'fa'
});

var bikeIconFull = L.ExtraMarkers.icon({
    markerColor: 'red',
    shape: 'circle',
    prefix: 'fa'
});

var bikeIconHalf = L.ExtraMarkers.icon({
    markerColor: 'green',
    shape: 'circle',
    prefix: 'fa'
});

var bikeIconAlmostFull = L.ExtraMarkers.icon({
    markerColor: 'pink',
    shape: 'circle',
    prefix: 'fa'
});

var bikeIconLow = L.ExtraMarkers.icon({
    markerColor: 'yellow',
    shape: 'circle',
    prefix: 'fa'
});

var bikeIconEmpty = L.ExtraMarkers.icon({
    markerColor: 'white',
    shape: 'circle',
    prefix: 'fa'
});


var eventIcon = L.ExtraMarkers.icon({
    icon: 'fa-university',
    iconColor: 'green',
    markerColor: 'green',
    shape: 'circle',
    prefix: 'fa'
});

function onLoad() {
    console.log("In onLoad.");
    document.addEventListener('deviceready', onDeviceReady, false);
}

function onDeviceReady() {
    console.log("In onDeviceReady.");

    $("#btn-login").on("touchstart", loginPressed);
    $("#sp-logout").on("touchstart", logoutPressed);
    $("#btn-signup").on("touchstart", signupPressed);
    $("#btn-signupsend").on("touchstart", registerPressed);
    $("#refresh-bikes").on("touchstart", refreshMap);

    if (localStorage.lastUserName && localStorage.lastUserPwd) {
        $("#in-username").val(localStorage.lastUserName);
        $("#in-password").val(localStorage.lastUserPwd);
    }

    $(document).on("pagecreate", "#map-page", function (event) {
        console.log("In pagecreate. Target is " + event.target.id + ".");
        $("#goto-currentlocation").on("touchstart", function () {
            getCurrentlocation();
        });
        $("#map-route").on("touchstart", function () {
            getCurrentlocation();
        });
        makeBasicMap();
        getCurrentlocation();
        setMapToCurrentLocation();
        getStationLocations();
        $("#map-page").enhanceWithin();
    });

    $(document).on("pageshow", function (event) {
        console.log("In pageshow. Target is " + event.target.id + ".");
        if(localStorage.authtoken){
            setUserName();
        }
    });

    $(document).on("pageshow", "#map-page", function () {
        if(!localStorage.authtoken) {
            $.mobile.navigate("#login-page");
        }
        console.log("Event pageshow #map-page");
        map.invalidateSize();
    });

    $(document).on("pageshow", "#signup-page", function() {
    })

    $('div[data-role="page"]').page();

    console.log("TOKEN: " + localStorage.authtoken);
    if (localStorage.authtoken) {
        $.mobile.navigate("#map-page");
    } else {
        $.mobile.navigate("#login-page");
    }
}

function loginPressed() {
    console.log("In loginPressed.");
    $.ajax({
        type: "GET",
        url: HOST + URLS["login"],
        data: {
            username: $("#in-username").val(),
            password: $("#in-password").val()
        }
    }).done(function (data, status, xhr) {
        localStorage.authtoken = localStorage.authtoken = "Token " + xhr.responseJSON.token;
        localStorage.lastUserName = $("#in-username").val();
        localStorage.lastUserPwd = $("#in-password").val();

        $.mobile.navigate("#map-page");
    }).fail(function (xhr, status, error) {
        var message = "Login Failed\n";
        if ((!xhr.status) && (!navigator.onLine)) {
            message += "Bad Internet Connection\n";
        }
        message += "Status: " + xhr.status + " " + xhr.responseText;
        showOkAlert(message);
        logoutPressed();
    });
}

function signupPressed() {
    $.mobile.navigate("#signup-page")
}

function registerPressed() {
    if($("#in-rpassword").val() == $("#in-crpassword").val()) {
        $.ajax({
            type: "GET",
            url: HOST + URLS["register"],
            data: {
                username: $("#in-rusername").val(),
                password: $("#in-rpassword").val(),
                email: $("#in-email").val(),
                firstname: $("#in-fname").val(),
                lastname: $("#in-lname").val()
            }
        }).done(function (data, status, xhr) {
            $.mobile.navigate("#login-page");
        }).fail(function (xhr, status, error) {
            var message = "Signup failed\n";
            if ((!xhr.status) && (!navigator.onLine)) {
                message += "Bad Internet Connection\n";
            }
            message += "Status: " + xhr.status + " " + xhr.responseText;
            showOkAlert(message);
            logoutPressed();
        });
    }
    else {
        showOkAlert("Passwords aren't matching");
    }
}

function logoutPressed() {
    console.log("logoutPressed");
    localStorage.removeItem("authtoken");
    $.mobile.navigate("#login-page");
    $.ajax({
        type: "GET",
        headers: {"Authorization": localStorage.authtoken},
        url: HOST + URLS["logout"]
     }).always(function () {
         localStorage.removeItem("authtoken");
         $.mobile.navigate("#login-page");
     });
}

function getCurrentlocation() {
    console.log("getCurrentlocation");
    var myLatLon;
    var myPos;

    navigator.geolocation.getCurrentPosition(
        function (pos) {
            myLatLon = L.latLng(pos.coords.latitude, pos.coords.longitude);
            myPos = new myGeoPosition(pos);
            localStorage.lastKnownCurrentPosition = JSON.stringify(myPos);

            setMapToCurrentLocation();
            getStationLocations();
        },
        function (err) {
        },
        {
            enableHighAccuracy: true,
            maximumAge: 60000,
            timeout: 5000
        }
    );
}

function refreshMap() {
    console.log("refreshMap");
    map.remove();
    map = L.map("map-var", {
        zoomControl: false,
        attributionControl: false
    }).fitWorld();
    L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        useCache: true
    }).addTo(map);

    getCurrentlocation();
    setMapToCurrentLocation();
    updatePosition();

    $("#leaflet-copyright").html("Leaflet | Map Tiles &copy; <a href='http://openstreetmap.org'>OpenStreetMap</a> contributors");
    
}

function getStationLocations() {
    console.log("Refreshing stations");
    $.ajax({
        type: "GET",
        headers: {"Authorization": localStorage.authtoken},
        url: HOST + URLS["get_station_data"]
    }).done(function (data, status, xhr) {
        var myData = JSON.parse(data.data);
        for (item in myData){
            var station = myData[item];
            var name = station.name;
            var pos = station.position;

            var bikeStands = station.bike_stands;
            var availableStands = station.available_bike_stands;
            var availableBikes = station.available_bikes;

            var myLat = pos.lat;
            var myLng = pos.lng;
            var latLng = L.latLng(myLat, myLng);
            
            var popupContent = 
                ("<b>" + name + "</b><br>"
                 + "Stands: <b>" + bikeStands + "</b><br>"
                 + "Free: <b>" + availableStands + "</b><br>"
                 + "Bikes: <b>" + availableBikes + "</b><br>"
                 + "<button onclick=mapRoute(" + myLng + "," + myLat 
                 + ")>Navigate </button>")
            
            if (availableStands == 0) {
                L.marker(latLng, {icon: bikeIconFull}).addTo(map).bindPopup(popupContent);
            } else
            if (availableBikes == 0) {
                L.marker(latLng, {icon: bikeIconEmpty}).addTo(map).bindPopup(popupContent);
            } else
            if (availableBikes <= 5) {
                L.marker(latLng, {icon: bikeIconLow}).addTo(map).bindPopup(popupContent);
            } else
            if (availableStands <= 5) {
                L.marker(latLng, {icon: bikeIconAlmostFull}).addTo(map).bindPopup(popupContent);
            } else {
                L.marker(latLng, {icon: bikeIconHalf}).addTo(map).bindPopup(popupContent);
            }
            
        } 
    }).fail(function (xhr, status, error) {
        $(".sp-username").html("");
    });
}

function mapRoute(long, lat){
    console.log("mapRoute");
    map.closePopup();
    if (localStorage.lastKnownCurrentPosition) {
            var myPos = JSON.parse(localStorage.lastKnownCurrentPosition);
            var myLatLon = L.latLng(myPos.coords.latitude, myPos.coords.longitude);
            
            var course = L.Routing.control({
                waypoints: [
                    L.latLng(myPos.coords.latitude, myPos.coords.longitude),
                    L.latLng(lat, long)
                ],
            createMarker: function() { return null;},
            }).addTo(map);
    }
    course.hide();
}

function setMapToCurrentLocation() {
    console.log("In setMapToCurrentLocation.");
    updatePosition();
    if (localStorage.lastKnownCurrentPosition) {
        var myPos = JSON.parse(localStorage.lastKnownCurrentPosition);
        var myLatLon = L.latLng(myPos.coords.latitude, myPos.coords.longitude);
        L.marker(myLatLon, {icon: curIcon}).addTo(map);
        map.flyTo([myLatLon.lat, myLatLon.lng], 15);
    }
}

function updatePosition() {
    console.log("In updatePosition.");
    if (localStorage.lastKnownCurrentPosition) {
        var myPos = JSON.parse(localStorage.lastKnownCurrentPosition);
        $.ajax({
            type: "PATCH",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": localStorage.authtoken
            },
            url: HOST + URLS["updateposition"],
            data: {
                lat: myPos.coords.latitude,
                lon: myPos.coords.longitude
            }
        }).done(function (data, status, xhr) {
            //showOkAlert("Position Updated");
        }).fail(function (xhr, status, error) {
            var message = "Position Update Failed\n";
            if ((!xhr.status) && (!navigator.onLine)) {
                message += "Bad Internet Connection\n";
            }
            message += "Status: " + xhr.status + " " + xhr.responseText;
            showOkAlert(message);
        }).always(function () {
            $.mobile.navigate("#map-page");
        });
    }
}

function makeBasicMap() {
    console.log("In makeBasicMap.");
    map = L.map("map-var", {
        zoomControl: false,
        attributionControl: false
    }).fitWorld();
    L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        useCache: true
    }).addTo(map);

    $("#leaflet-copyright").html("Leaflet | Map Tiles &copy; <a href='http://openstreetmap.org'>OpenStreetMap</a> contributors");
}

function myGeoPosition(p) {
    this.coords = {};
    this.coords.latitude = p.coords.latitude;
    this.coords.longitude = p.coords.longitude;
    this.coords.accuracy = (p.coords.accuracy) ? p.coords.accuracy : 0;
    this.timestamp = (p.timestamp) ? p.timestamp : new Date().getTime();
}

function setUserName() {
    console.log("In setUserName.");
    $.ajax({
        type: "GET",
        headers: {"Authorization": localStorage.authtoken},
        url: HOST + URLS["userme"]
    }).done(function (data, status, xhr) {
        $(".sp-username").html(xhr.responseJSON.properties.username);
    }).fail(function (xhr, status, error) {
        $(".sp-username").html("");
    });
}