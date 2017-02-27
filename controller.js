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
.directive('tooltip', function() {
    return {
        restrict: 'A',
        link: function(scope, element, attrs){
            $(element).click(function() {
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
.directive('origininputautocomplete', ['Initializer', function(Initializer) {
    return {
        require: 'ngModel',
        link: function(scope, element, attrs, model) {
			Initializer.mapsInitialized.then(function() { scope.setAutocomplete(element[0], scope, model, true); });
			$(element).focus(function() {
				scope.clickMode = 'origin';
				$(element).attr("placeholder", "Enter a location or click on the map");
				scope.$apply();
			});
			/*$(element).blur(function() {
				scope.clickMode = null;
				$(element).attr("placeholder", "Enter a location");
			});*/
        }
    };
}])
.directive('destinputautocomplete', ['Initializer', function(Initializer) {
    return {
        require: 'ngModel',
        link: function(scope, element, attrs, model) {
			Initializer.mapsInitialized.then(function() { scope.setAutocomplete(element[0], scope, model, false); });
			$(element).focus(function() {
				scope.clickMode = 'dest';
				$(element).attr("placeholder", "Enter a location or click on the map");
				scope.$apply();
			});
			/*$(element).blur(function() {
				scope.clickMode = null;
				$(element).attr("placeholder", "Enter a location");
			});*/
        }
    };
}]);;

app.controller('myCtrl', ['$scope', 'Initializer', '$http', '$q', function($scope, Initializer, $http, $q) {
	$scope.directionsDisplays = [];
	$scope.directionsService;
	$scope.adaStations;
	$scope.stationStatus;
	$scope.lineStatus;
	$scope.placesService;
	$scope.geocoder;
	$scope.distanceMatrixService;
	$scope.origin;
	$scope.destination;
	$scope.originPoint;
	$scope.destPoint;
	$scope.originMarker;
	$scope.destMarker;
	$scope.originAutocomplete;
	$scope.destAutocomplete;
	$scope.map;
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
	$scope.autocomplete = {
		'origin': null,
		'dest': null
	};
	$scope.showRoute = false;
	$scope.pageLoading = true;
	$scope.clickMode = null;
	
	//nyc bounding box lat/lon constants
	$scope.NYC_LAT_NORTH = 40.917577;
	$scope.NYC_LAT_SOUTH = 40.477399;
	$scope.NYC_LON_EAST = -73.700272;
	$scope.NYC_LON_WEST = -74.259090;
	
    $scope.initMap = function() {
		Initializer.mapsInitialized.then(function() {
			$scope.map = new google.maps.Map(document.getElementById('map'), {
				zoom: 10,
				center: {lat: 40.7831, lng: -73.9712}
			});
			google.maps.event.addListener($scope.map, 'click', function(event) {
				if ($scope.clickMode) {
					var lat = event.latLng.lat();
					var lon = event.latLng.lng();
					if (lat > $scope.NYC_LAT_NORTH || lat < $scope.NYC_LAT_SOUTH ||
						lon > $scope.NYC_LON_EAST || lon < $scope.NYC_LAT_WEST)
						return;
					else {
						$scope.geocoder.geocode({'location': event.latLng}, function(results, status) {
							if (status === 'OK') {
								if (results[0]) {
									if ($scope.clickMode == 'origin') {
										if ($scope.originMarker) $scope.originMarker.setMap(null);
										$scope.originPoint = results[0];
										$scope.origin = results[0].formatted_address;
										$scope.originMarker = $scope.createMarker(results[0], 'Origin');
										$('#originInput').attr('nomapclick', 'false');
									}
									else if ($scope.clickMode == 'dest') {
										if ($scope.destMarker) $scope.destMarker.setMap(null);
										$scope.destPoint = results[0];
										$scope.destination = results[0].formatted_address;
										$scope.destMarker = $scope.createMarker(results[0], 'Destination');
										$('#destInput').attr('nomapclick', 'false');
									}
									$scope.$apply();
								}
							}
							$scope.clickMode = null;
							$('.fieldTextBox').attr("placeholder", "Enter a location");
						});
					}
				}
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
		
		if (!Array.prototype.indexOf) {
			Array.prototype.indexOf = function(searchElement, fromIndex) {
				var k;
				if (this == null)
					throw new TypeError('"this" is null or not defined');
					
				var o = Object(this);
				var len = o.length >>> 0;
				if (len === 0)
					return -1;
				
				var n = fromIndex | 0;
				if (n >= len)
					return -1;
				
				k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);
				while (k < len) {
					if (k in o && o[k] === searchElement)
						return k;
					k++;
				}
				return -1;
			};
		}
		
		if (!Object.keys) {
			Object.keys = (function() {
				'use strict';
				var hasOwnProperty = Object.prototype.hasOwnProperty,
				hasDontEnumBug = !({ toString: null }).propertyIsEnumerable('toString'),
				dontEnums = [
					'toString',
					'toLocaleString',
					'valueOf',
					'hasOwnProperty',
					'isPrototypeOf',
					'propertyIsEnumerable',
					'constructor'
				],
				dontEnumsLength = dontEnums.length;

				return function(obj) {
					if (typeof obj !== 'function' && (typeof obj !== 'object' || obj === null))
						throw new TypeError('Object.keys called on non-object');

					var result = [], prop, i;

					for (prop in obj) {
						if (hasOwnProperty.call(obj, prop))
							result.push(prop);
					}

					if (hasDontEnumBug) {
						for (i = 0; i < dontEnumsLength; i++) {
							if (hasOwnProperty.call(obj, dontEnums[i]))
								result.push(dontEnums[i]);
						}
					}
					return result;
				};
			}());
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
					var stationsByName = new Array();
					for (var i=stations.length-1; i>=0; i--) {
						if (stations[i].ADA != "Y")
							stations.splice(i, 1);
						else {
							var builtStationName = $scope.buildStationName(stations[i].station);
							var trains = stations[i].trainno.split("/");
							stations[i].builtStationName = builtStationName;
							if (!stationsByName[builtStationName]) {
								stationsByName[builtStationName] = stations[i];
								stationsByName[builtStationName].trainArr = new Array();
							}
							for (var j=0; j<trains.length; j++) {
								stationsByName[builtStationName].trainArr[trains[j]] = true;
							}
						}
					}
					//special case for fulton st, R train is accessible but doesn't appear
					stationsByName['fulton st'].trainArr['R'] = true;
					/*stations.sort(function(a,b) {
						return a.builtStationName.localeCompare(b.builtStationName);
					});*/
					//$scope.adaStations = stations;
					var stationIndex = 0;
					for (var stationName in stationsByName) {
						var station = stationsByName[stationName];
						station.index = stationIndex;
						var adjacentStations = [];
						for (var adjStationName in stationsByName) {
							if (stationName == adjStationName) continue;
							var adjStation = stationsByName[adjStationName];
							for (var train in station.trainArr) {
								if (adjStation.trainArr[train]) {
									adjacentStations.push(adjStationName);
									break;
								}
							}
						}
						station.adjacentStations = adjacentStations;
						stationIndex++;
					}
					$scope.adaStations = stationsByName;
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
	
	$scope.setAutocomplete = function(autocompleteElement, scope, model, isOrigin) {
		var options = {
			bounds: new google.maps.LatLngBounds(
						new google.maps.LatLng($scope.NYC_LAT_SOUTH, $scope.NYC_LON_WEST),
						new google.maps.LatLng($scope.NYC_LAT_NORTH, $scope.NYC_LON_EAST)
					)
		};
		var autocomplete = new google.maps.places.Autocomplete(autocompleteElement, options);

		autocompleteElement.onchange = function() {
			$(autocompleteElement).attr('noautocomplete', 'true');
			$(autocompleteElement).attr('nomapclick', 'true');
			if (isOrigin && $scope.originMarker) $scope.originMarker.setMap(null);
			else if (!isOrigin && $scope.destMarker) $scope.destMarker.setMap(null);
		}
		
		google.maps.event.addListener(autocomplete, 'place_changed', function() {
			$(autocompleteElement).attr('noautocomplete', 'false');
			scope.$apply(function() {
				model.$setViewValue($(autocompleteElement).val());                
			});
			if (isOrigin) {
				if ($scope.originMarker) $scope.originMarker.setMap(null);
				$scope.originMarker = $scope.createMarker(scope.autocomplete.origin.getPlace(), 'Origin');
			}
			else {
				if ($scope.destMarker) $scope.destMarker.setMap(null);
				$scope.destMarker = $scope.createMarker(scope.autocomplete.dest.getPlace(), 'Destination');
			}
		});
		
		if (isOrigin)
			scope.autocomplete.origin = autocomplete;
		else
			scope.autocomplete.dest = autocomplete;
	};
	
	$scope.getLines = function(station1name, station2name) {
		var station1 = $scope.adaStations[station1name];
		var station2 = $scope.adaStations[station2name];
		var lines = [];
		for (var train in station1.trainArr) {
			if (station2.trainArr[train])
				lines.push(train);
		}
		return lines;
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
		var dist = new Array();
		var prev = new Array();
		var Q = new Array();
		for (var stationName in stations) {
			dist[stationName] = Number.MAX_VALUE;
			Q[stationName] = stations[stationName];
		}
		
		dist[startStation] = 0;
		
		while (Object.keys(Q).length > 0) {
			var minDist = Number.MAX_VALUE;
			var minDistStation = null;
			var minDistIndex = -1;
			for (var stationName in Q) {
				if (dist[stationName] < minDist) {
					minDist = dist[stationName];
					minDistStation = Q[stationName];
					minDistStationName = stationName;
				}
			}
			delete Q[minDistStationName]
			
			if (!minDistStation) break;
			
			var minDistStationLatLon = $scope.stationLatLon[minDistStationName];
			var minDistTrains = minDistStation.trainArr;
			minDistStation.latLon = minDistStationLatLon;
			
			for (var i=0; i<minDistStation.adjacentStations.length; i++) {
				var neighborName = minDistStation.adjacentStations[i];
				var neighbor = stations[neighborName];
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
							var stationStatusTrains = stationStatuses[j].trainno.split("/");
							for (var j=0; j<stationStatusTrains.length; j++) {
								if (minDistStation.trainArr[stationStatusTrains[j]] || neighbor.trainArr[stationStatusTrains[j]]) {
									outOfService = true;
									break;
								}
							}
						}
					}
					if (outOfService) distanceNeighbor = distanceNeighbor + 100;
				}
				var alt = dist[minDistStationName] + distanceNeighbor;
				if (alt < dist[neighborName]) {
					dist[neighborName] = alt;
					prev[neighborName] = minDistStationName;
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
	
	$scope.createMarker = function(place, label) {
		var marker = $scope.createMarkerOnLoc(place.geometry.location, label);

        google.maps.event.addListener(marker, 'click', function() {
			infowindow.setContent(place.name);
			infowindow.open($scope.map, this);
        });
		
		return marker;
    }
	
	$scope.createMarkerOnLoc = function(location, label) {
		var marker = new google.maps.Marker({
			position: location,
			label: label,
			map: $scope.map
		});
		
		return marker;
    }
	
	$scope.trainArrayStr = function(trainArr) {
		var tempArr = [];
		for (var train in trainArr) {
			tempArr.push(train);
		}
		
		return tempArr.join('/');
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
					var builtName = $scope.buildStationName(results[i].name);
					if ($scope.adaStations[builtName] && nearADAStationMTAs.indexOf(builtName) < 0)
						nearADAStationMTAs.push(builtName);
				}
				if (origin) {
					$scope.foundStations.origin = nearADAStationMTAs;
					$scope.selectedStations.origin = nearADAStationMTAs[0];
				}
				else {
					$scope.foundStations.dest = nearADAStationMTAs;
					$scope.selectedStations.dest = nearADAStationMTAs[0];
				}
				$scope.$apply();
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
			$scope.routeDirections($scope.origin, dest, 'WALKING');
		}
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
		else {
			$scope.routePath = [];
			$scope.routeMapPath([]);
		}
	});
	
	$scope.$watch('clickMode', function() { 
		if ($scope.clickMode && $scope.clickMode == 'origin')
			$('#destInput').attr("placeholder", "Enter a location");
		else if ($scope.clickMode && $scope.clickMode == 'dest')
			$('#originInput').attr("placeholder", "Enter a location");
	}, true);
	
    $scope.route = function() {
		if ($('#originInput').attr('noautocomplete') == 'false' && $scope.autocomplete.origin.getPlace())
			$scope.searchADAStations($scope.origin, $scope.autocomplete.origin.getPlace().geometry.location, true);
		else if ($('#originInput').attr('nomapclick') == 'false' && $scope.originPoint)
			$scope.searchADAStations($scope.origin, $scope.originPoint.geometry.location, true);
		else {
			$scope.geocoder.geocode({'address': $scope.origin}, function(results, status) {
				if (status === 'OK') {
					//$scope.createMarker(results[0]);
					if (results[0])
						$scope.searchADAStations($scope.origin, results[0].geometry.location, true);
				}
				else
					window.alert('Geocode of origin not successful for the following reason: ' + status);
			});
		}
		
		if ($('#destInput').attr('noautocomplete') == 'false' && $scope.autocomplete.dest.getPlace())
			$scope.searchADAStations($scope.destination, $scope.autocomplete.dest.getPlace().geometry.location, false);
		else if ($('#destInput').attr('nomapclick') == 'false' && $scope.destPoint)
			$scope.searchADAStations($scope.origin, $scope.destPoint.geometry.location, false);
		else {
			$scope.geocoder.geocode({'address': $scope.destination}, function(results, status) {
				if (status === 'OK') {
					//$scope.createMarker(results[0]);
					if (results[0])
						$scope.searchADAStations($scope.destination, results[0].geometry.location, false);
				}
				else
					window.alert('Geocode of destination not successful for the following reason: ' + status);
			});
		}
    }
	
	$scope.closeTooltip = function($event) {
		$($event.currentTarget).parent().hide();
	}
	
	$scope.initMap();
}]);