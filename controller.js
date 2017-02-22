var app = angular.module('myApp', ['ngSanitize'])
.factory('Initializer', function($window, $q){

    //Google's url for async maps initialization accepting callback function
    var asyncUrl = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyBEMXnUiLoUh3eGcrRFdMlsntseehAI774&libraries=places&callback=',
        mapsDefer = $q.defer();

    //Callback function - resolving promise after maps successfully loaded
    $window.googleMapsInitialized = mapsDefer.resolve; // removed ()

    //Async loader
    var asyncLoad = function(asyncUrl, callbackName) {
		var script = document.createElement('script');
		//script.type = 'text/javascript';
		script.src = asyncUrl + callbackName;
		document.body.appendChild(script);
    };

    //Start loading google maps
    asyncLoad(asyncUrl, 'googleMapsInitialized');

    //Usage: Initializer.mapsInitialized.then(callback)
    return {
        mapsInitialized : mapsDefer.promise
    };
})
.directive('tooltip', function(){
    return {
        restrict: 'A',
        link: function(scope, element, attrs){
            $(element).click(function(){
				var statusTooltip = $(element).parent().find('.statusTooltip');
				var show = true;
				if (statusTooltip.is(':visible')) show = false;
                $('.statusTooltip').hide();
				if (show)
					statusTooltip.show();
            });
        }
    };
})

app.controller('myCtrl', ['$scope', 'Initializer', '$http', '$q', function($scope, Initializer, $http, $q) {
	$scope.directionsDisplays = [];
	$scope.directionsService;
	$scope.adaStations;
	$scope.stationStatus;
	$scope.lineStatus;
	$scope.placesService;
	$scope.geocoder;
	$scope.distanceMatrixService;
	$scope.map;
	//$scope.originADAStations = [];
	//$scope.destinationADAStations = [];
	$scope.originADAStation;
	$scope.destinationADAStation;
	$scope.adaStationEdges = [];
	$scope.routePath;
	$scope.stationLatLon;
	$scope.selectedStations = {};
	$scope.foundStations = {};
	$scope.routeOptions = {
		'routeOption': 'shortest',
		'avoidService': 'YES'
	};
	$scope.showRoute = false;
	$scope.pageLoading = true;
	
    $scope.initMap = function() {
		Initializer.mapsInitialized.then(function() {
			$scope.map = new google.maps.Map(document.getElementById('map'), {
				zoom: 10,
				center: {lat: 40.7831, lng: -73.9712}
			});
			//$scope.directionsDisplay = new google.maps.DirectionsRenderer;
			//$scope.directionsDisplay.setMap($scope.map);
            $scope.directionsService = new google.maps.DirectionsService;
			$scope.placesService = new google.maps.places.PlacesService($scope.map);
			$scope.geocoder = new google.maps.Geocoder();
			$scope.distanceMatrixService = new google.maps.DistanceMatrixService();
		});
		
		if (!String.prototype.endsWith) {
			String.prototype.endsWith = function(searchString, position) {
				var subjectString = this.toString();
				if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
					position = subjectString.length;
				}
				position -= searchString.length;
				var lastIndex = subjectString.indexOf(searchString, position);
				return lastIndex !== -1 && lastIndex === position;
			};
		}
		
		$q.all([
			(function() {
				var d = $q.defer();
				$http({
					method: 'GET',
					url: 'allequipments'
				}).then(function successCallback(response) {
					var x2js = new X2JS();
					var stations = x2js.xml_str2json(response.data);
					stations = stations.NYCEquipments.equipment;
					for (var i=stations.length-1; i>=0; i--) {
						if (stations[i].ADA != "Y")
							stations.splice(i, 1);
						else
							stations[i].builtStationName = $scope.buildStationName(stations[i].station)
					}
					stations.sort(function(a,b) {
						return a.builtStationName.localeCompare(b.builtStationName);
					});
					$scope.adaStations = stations;
					for (var i=0; i<$scope.adaStations.length; i++) {
						var currStation = $scope.adaStations[i];
						currStation.index = i;
						var trains = currStation.trainno.split("/");
						var adjacentStations = [];
						for (var j=0; j<$scope.adaStations.length; j++) {
							if (j==i) continue;
							var jStation = $scope.adaStations[j];
							var jTrains = jStation.trainno.split("/");
							if ($scope.intersectTrains(trains, jTrains)) {
								adjacentStations.push(j);
								if (!$scope.adaStationEdges[i])
									$scope.adaStationEdges[i] = []
								$scope.adaStationEdges[i][j] = 1;
							}
						}
						currStation.adjacentStations = adjacentStations;
					}
					d.resolve(response);
				}, function errorCallback(response) {
					window.alert('ADA station request failed due to ' + response.statusText);
				});
				return d.promise;
			})(),
			(function() {
				var d = $q.defer();
				$http({
					method: 'GET',
					url: 'stationstatus'
				}).then(function successCallback(response) {
					var x2js = new X2JS();
					var stations = x2js.xml_str2json(response.data);
					stations = stations.NYCOutages.outage;
					var stationADAStatus = new Array();
					for (var i=0; i<stations.length; i++) {
						var stationName = $scope.buildStationName(stations[i].station);
						if (!stationADAStatus[stationName])
							stationADAStatus[stationName] = [];
						stationADAStatus[stationName].push(stations[i]);
					}
					$scope.stationStatus = stationADAStatus;
					d.resolve(response);
				}, function errorCallback(response) {
					window.alert('ADA station request failed due to ' + response.statusText);
				});
				return d.promise;
			})(),
			(function() {
				var d = $q.defer();
				$http({
					method: 'GET',
					url: 'linestatus'
				}).then(function successCallback(response) {
					var x2js = new X2JS();
					var status = x2js.xml_str2json(response.data);
					status = status.service.subway.line;
					var lineStatus = new Array();
					for (var i=0; i<status.length; i++) {
						if (status[i].status != 'GOOD SERVICE') {
							var lines = status[i].name.split("");
							for (var j=0; j<lines.length; j++) {
								lineStatus[lines[j]] = status[i];
							}
						}
					}
					$scope.lineStatus = lineStatus;
					d.resolve(response);
				}, function errorCallback(response) {
					window.alert('ADA station request failed due to ' + response.statusText);
				});
				return d.promise;
			})(),
			(function() {
				var d = $q.defer();
				$http({
					method: 'GET',
					url: 'stops.txt'
				}).then(function successCallback(response) {
					var jsonobject = Papa.parse(response.data);
					var stops = new Array();
					for (var i=1; i<jsonobject.data.length; i++) {
						if (!jsonobject.data[i][2]) continue;
						var stationName = $scope.buildStationName(jsonobject.data[i][2]);
						stops[stationName] = {
							"lat": jsonobject.data[i][4],
							"lon": jsonobject.data[i][5],
						}
					}
					$scope.stationLatLon = stops;
					d.resolve(response);
				});
				return d.promise;
			})()
		]).then(function(responses) {
			$scope.pageLoading = false;
		});
	}
	
	$scope.getLines = function(station1index, station2index) {
		var station1 = $scope.adaStations[station1index];
		var station2 = $scope.adaStations[station2index];
		var trains1 = station1.trainno.split("/");
		var trains2 = station2.trainno.split("/");
		var lines = [];
		for (var i=0; i<trains1.length; i++) {
			for (var j=0; j<trains2.length; j++) {
				if (trains1[i] == trains2[j]) lines.push(trains1[i]);
			}
		}
		return lines;
	}
	
	$scope.intersectTrains = function(aTrains, bTrains) {
		for (var i=0; i<aTrains.length; i++) {
			for (var j=0; j<bTrains.length; j++) {
				if (aTrains[i] == bTrains[j]) return true;
			}
		}
		return false;
	}
	
	$scope.latLonDist = function(station1, station2) {
		var radlat1 = Math.PI * station1.lat/180;
		var radlat2 = Math.PI * station2.lat/180;
		var theta = station1.lon-station2.lon;
		var radtheta = Math.PI * theta/180;
		var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
		dist = Math.acos(dist);
		dist = dist * 180/Math.PI;
		dist = dist * 60 * 1.1515;
		dist = dist * 1.609344;
		return dist;
	}
	
	$scope.shortestPath = function(edges, stations, startStation) {
		var dist = new Array(stations.length);
		var prev = new Array(stations.length);
		var Q = new Array(stations.length);
		for (var i=0; i<stations.length; i++) {
			dist[i] = Number.MAX_VALUE;
			stations[i].distIndex = i;
			Q[i] = stations[i];
		}
		
		dist[startStation] = 0;
		
		while (Q.length > 0) {
			var minDist = Number.MAX_VALUE;
			var minDistStation = null;
			var minDistIndex = -1;
			for (var i=0; i<Q.length; i++) {
				if (dist[Q[i].distIndex] < minDist) {
					minDist = dist[Q[i].distIndex];
					minDistStation = Q[i];
					minDistIndex = i;
				}
			}
			Q.splice(minDistIndex, 1);
			
			if (!minDistStation) break;
			
			var minDistStationName = $scope.buildStationName(minDistStation.station);
			var minDistStationLatLon = $scope.stationLatLon[minDistStationName];
			var minDistTrains = minDistStation.trainno.split("/");
			minDistStation.latLon = minDistStationLatLon;
			
			for (var i=0; i<minDistStation.adjacentStations.length; i++) {
				var neighborIndex = minDistStation.adjacentStations[i];
				var neighbor = stations[neighborIndex];
				var neighborName = $scope.buildStationName(neighbor.station);
				var neighborLatLon = $scope.stationLatLon[neighborName];
				neighbor.latLon = neighborLatLon;
				var distanceNeighbor = 100;
				if (minDistStationLatLon && neighborLatLon)
					distanceNeighbor = $scope.latLonDist(minDistStationLatLon, neighborLatLon);
				if ($scope.routeOptions.routeOption == 'leastTransfers')
					distanceNeighbor = distanceNeighbor + 100;
				if ($scope.routeOptions.avoidService == 'YES' && $scope.stationStatus[neighborName]) {
					var stationStatuses = $scope.stationStatus[neighborName];
					var outOfService = false;
					for (var j=0; j<stationStatuses.length; j++) {
						if (stationStatuses[j].equipmenttype == 'EL') {
							var lines = $scope.getLines(minDistIndex, neighborIndex);
							var stationStatusTrains = stationStatuses[j].trainno.split("/");
							if ($scope.intersectTrains(lines, stationStatusTrains)) {
								outOfService = true;
								break;
							}
						}
					}
					if (outOfService) distanceNeighbor = distanceNeighbor + 100;
				}
				var alt = dist[minDistStation.distIndex] + distanceNeighbor;
				if (alt < dist[neighbor.distIndex]) {
					dist[neighbor.distIndex] = alt;
					prev[neighbor.distIndex] = minDistStation.index;
				}
			}
		}
		
		return {
			"startStation": startStation,
			"dist": dist,
			"prev": prev
		}
	}
	
	$scope.constructPath = function(pathInfo, endStation) {
		var path = [];
		while (pathInfo.prev[endStation]) {
			path.unshift(endStation);
			endStation = pathInfo.prev[endStation];
		}
		path.unshift(endStation);
		return path;
	}
	
	$scope.buildStationName = function(name) {
		var nameArr = name.split('-');
		var numArr = [];
		var numberPattern = /\d+/g;
		for (var i = 0; i<nameArr.length; i++) {
			nameArr[i] = $scope.cleanStationName(nameArr[i]);
			numArr[i] = nameArr[i].match(numberPattern);
		}
		var numStr = '';
		var nameStr = '';
		var containsName = false;
		var containsNum = false;
		for (var i = 0; i<nameArr.length; i++) {
			if (!containsNum && numArr[i] && numArr[i].length > 0) {
				numStr = numArr[i].join('/');
				containsNum = true;
			}
			else {
				nameStr = nameArr[i];
				containsName = true;
			}
		}
		if (containsName && containsNum)
			return numStr + ' ' + nameStr;
		else if (containsNum) return numStr;
		else return nameStr;
	}
	
	// clean station name for search purposes
	$scope.cleanStationName = function(name) {
		name = name.toLowerCase();
		if (name.endsWith("subway station")) name = name.replace("subway station", "");
		else if (name.endsWith("station")) name = name.replace("station", "");
		
		name = name.replace("street", "st");
		name = name.replace("center", "ctr");
		name = name.replace("avenue", "av");
		name = name.replace(" ave", " av");
		name = name.replace("circle", "cir");
		name = name.replace("square", "sq");
		
		return name.trim();
	}
	
	// binary search for station name
	$scope.searchStation = function(stationName) {
		stationName = $scope.buildStationName(stationName);
		var minIndex = 0;
		var maxIndex = $scope.adaStations.length - 1;
		var currIndex;
		var currStation;
		
		while (minIndex <= maxIndex) {
			currIndex = (minIndex + maxIndex) / 2 | 0;
			currStation = $scope.adaStations[currIndex];
			var currStationName = currStation.builtStationName;
			if (currStationName < stationName)
				minIndex = currIndex + 1;
			else if (currStationName > stationName)
				maxIndex = currIndex - 1;
			else 
				return currIndex;
		}
		
		return -1;
	}
	
	$scope.createMarker = function(place) {
        var placeLoc = place.geometry.location;
		
        var marker = new google.maps.Marker({
			map: $scope.map,
			position: place.geometry.location
        });

        google.maps.event.addListener(marker, 'click', function() {
			infowindow.setContent(place.name);
			infowindow.open($scope.map, this);
        });
    }
	
	$scope.searchADAStations = function(name, loc, origin) {
		$scope.placesService.nearbySearch({
			location: loc,
			radius: 1000,
			type: ['subway_station']
		}, function(results, status) {
			if (status === google.maps.places.PlacesServiceStatus.OK) {
				var nearADAStationLocs = [];
				var nearADAStations = [];
				var nearADAStationMTAs = [];
				for (var i = 0; i < results.length; i++) {
					var adaStationIndex = $scope.searchStation(results[i].name);
					if (adaStationIndex > -1) {
						if (nearADAStationMTAs.indexOf(adaStationIndex) == -1) {
							nearADAStationLocs.push(results[i].geometry.location);
							nearADAStations.push(results[i]);
							nearADAStationMTAs.push(adaStationIndex);
						}
					}
				}
				if (origin) $scope.foundStations.origin = nearADAStationMTAs;
				else $scope.foundStations.dest = nearADAStationMTAs;
				$scope.$apply();
				/*$scope.distanceMatrixService.getDistanceMatrix({
					origins: [name],
					destinations: nearADAStationLocs,
					travelMode: 'WALKING'
				}, function(response, status) {
					var minDist = Number.MAX_VALUE;
					var minDistIndex = -1;
					for (var i = 0; i < response.rows[0].elements.length; i++) {
						if (response.rows[0].elements[i].distance.value < minDist) {
							minDist = response.rows[0].elements[i].distance.value;
							minDistIndex = i;
						}
					}
					$scope.createMarker(nearADAStations[minDistIndex]);
					var ADAStation = {
						"station": nearADAStations[minDistIndex],
						"MTAStationIndex": nearADAStationMTAs[minDistIndex]
					}
					if (origin) $scope.originADAStation = ADAStation;
					else $scope.destinationADAStation = ADAStation;
					$scope.routeStation();
				});*/
			}
		});
	}
	
	$scope.routeStation = function() {
		if ($scope.selectedStations.origin && $scope.selectedStations.dest) {
			var shortestPathInfo = $scope.shortestPath($scope.adaStationEdgeArr, $scope.adaStations, $scope.selectedStations.origin);
			var path = $scope.constructPath(shortestPathInfo, $scope.selectedStations.dest);
			$scope.routePath = path;
			$scope.routeMapPath(path);
			
			$scope.originADAStation = null;
			$scope.destinationADAStation = null;
		}
	}
	
	$scope.routeDirections = function(origin, destination, travelMode) {
		$scope.directionsService.route({
			origin: origin,
			destination: destination,
			travelMode: travelMode
		}, function(response, status) {
			if (status === 'OK') {
				var directionsDisplay = new google.maps.DirectionsRenderer;
				directionsDisplay.setMap($scope.map);
				directionsDisplay.setDirections(response);
				$scope.directionsDisplays.push(directionsDisplay);
			} else {
				window.alert('Directions request failed due to ' + status);
			}
		})
	}
	
	$scope.routeMapPath = function(path) {
		if ($scope.directionsDisplays.length > 0) {
			for (var i=0; i<$scope.directionsDisplays.length; i++) {
				$scope.directionsDisplays[i].setMap(null);
				$scope.directionsDisplays[i] = null;
			}
			$scope.directionsDisplays = [];
		}
		var dest = $scope.destination;
		if (path.length > 0) {
			var destStation = $scope.adaStations[path[0]];
			dest = destStation.station;
			if (destStation.latLon)
				dest = new google.maps.LatLng(destStation.latLon.lat, destStation.latLon.lon);
		}
		$scope.routeDirections($scope.origin, dest, 'WALKING');
		for (var i=0; i<path.length - 1; i++) {
			var originStation = $scope.adaStations[path[i]];
			var destStation = $scope.adaStations[path[i+1]];
			var origin = originStation.station;
			var dest = destStation.station;
			if (originStation.latLon)
				origin = new google.maps.LatLng(originStation.latLon.lat, originStation.latLon.lon);
			if (destStation.latLon)
				dest = new google.maps.LatLng(destStation.latLon.lat, destStation.latLon.lon);
			$scope.routeDirections(origin, dest, 'TRANSIT');
		}
		if (path.length > 0) {
			var originStation = $scope.adaStations[path[path.length-1]];
			var origin = originStation.station;
			if (originStation.latLon)
				origin = new google.maps.LatLng(originStation.latLon.lat, originStation.latLon.lon);
			$scope.routeDirections(origin, $scope.destination, 'WALKING');
		}
	}
	
	$scope.$watchGroup(['selectedStations.origin', 'selectedStations.dest', 'routeOptions.routeOption', 'routeOptions.avoidService'], function(newVal, oldVal) { 
		if ($scope.adaStations && $scope.selectedStations.origin && $scope.selectedStations.dest) {
			$scope.routeStation();
			$scope.showRoute = true;
		}
	});
	
    $scope.route = function() {
		//var shortestPathInfo = $scope.shortestPath($scope.adaStationEdgeArr, $scope.adaStations, 101);
		//var path = $scope.constructPath(shortestPathInfo, 94);
		//var shortestPathInfo = $scope.shortestPath($scope.adaStationEdgeArr, $scope.adaStations, 248);
		//var path = $scope.constructPath(shortestPathInfo, 104);
		//var shortestPathInfo = $scope.shortestPath($scope.adaStationEdgeArr, $scope.adaStations, 187);
		//var path = $scope.constructPath(shortestPathInfo, 77);
		//var shortestPathInfo = $scope.shortestPath($scope.adaStationEdgeArr, $scope.adaStations, 34);
		//var path = $scope.constructPath(shortestPathInfo, 101);
		//var shortestPathInfo = $scope.shortestPath($scope.adaStationEdgeArr, $scope.adaStations, 84);
		//var path = $scope.constructPath(shortestPathInfo, 187);
		//$scope.routePath = path;
		//$scope.routeMapPath(path);
		
		//$scope.originADAStations = [124,187];
		
		//$scope.destinationADAStations = [77];
				
		$scope.geocoder.geocode({'address': $scope.origin}, function(results, status) {
			if (status === 'OK') {
				//$scope.createMarker(results[0]);
				$scope.searchADAStations($scope.origin, results[0].geometry.location, true);
			}
			else
				window.alert('Geocode of origin not successful for the following reason: ' + status);
		});
		
		$scope.geocoder.geocode({'address': $scope.destination}, function(results, status) {
			if (status === 'OK') {
				//$scope.createMarker(results[0]);
				$scope.searchADAStations($scope.destination, results[0].geometry.location, false);
			}
			else
				window.alert('Geocode of destination not successful for the following reason: ' + status);
		});
		
		/*$scope.directionsService.route({
			origin: $scope.origin,
			destination: $scope.destination,
			travelMode: 'TRANSIT'
		}, function(response, status) {
			if (status === 'OK') {
				$scope.directionsDisplay.setDirections(response);
			} else {
				window.alert('Directions request failed due to ' + status);
			}
        });*/
    }
	
	$scope.closeTooltip = function($event) {
		$($event.currentTarget).parent().hide();
	}
	
	$scope.initMap();
}]);