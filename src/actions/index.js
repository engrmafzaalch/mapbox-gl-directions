import * as types from '../constants/action_types';
import mapboxgl from 'mapbox-gl';
import { inProximity } from '../utils';
import MapboxClient from 'mapbox';
let mapbox;

function originPoint(feature) {
  return {
    type: types.ORIGIN,
    origin: feature
  };
}

function destinationPoint(feature) {
  return {
    type: types.DESTINATION,
    destination: feature
  };
}

function originResults(query, results) {
  return {
    type: types.ORIGIN_INPUT,
    query,
    results
  };
}

function destinationResults(query, results) {
  return {
    type: types.DESTINATION_INPUT,
    query,
    results
  };
}

function setDirections(directions) {
  return {
    type: types.DIRECTIONS,
    directions
  };
}

function geocode(query, callback) {
  return dispatch => {
    return mapbox.geocodeForward(query.trim(), (err, res) => {
      if (err) throw err;
      dispatch(callback(res.features));
    });
  };
}

function fetchDirections(query, profile) {
  return dispatch => {
    return mapbox.getDirections(query, {
      profile: 'mapbox.' + profile,
      geometry: 'polyline'
    }, (err, res) => {
      if (err) throw err;
      if (res.error) throw res.error;
      dispatch(setRouteIndex(0));
      dispatch(setDirections(res.routes));

      // Revise origin + destination
      dispatch(originPoint(Object.assign(res.origin, {
        properties: {
          id: 'origin',
          'marker-symbol': 'A'
        }
      })));
      dispatch(destinationPoint(Object.assign(res.destination, {
        properties: {
          id: 'destination',
          'marker-symbol': 'B'
        }
      })));

    });
  };
}

function setHoverMarker(feature) {
  return {
    type: types.HOVER_MARKER,
    hoverMarker: feature
  };
}

function buildPoint(coordinates, properties) {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: coordinates
    },
    properties: properties
  };
}

function buildDirectionsQuery(origin, destination, waypoints) {
  let query = [{
    longitude: origin.geometry.coordinates[0],
    latitude: origin.geometry.coordinates[1]
  }];

  // Add any waypoints.
  if (waypoints.length) {
    waypoints.forEach((waypoint) => {
      query.push({
        longitude: waypoint.geometry.coordinates[0],
        latitude: waypoint.geometry.coordinates[1]
      });
    });
  }

  query.push({
    longitude: destination.geometry.coordinates[0],
    latitude: destination.geometry.coordinates[1]
  });

  return query;
}

export function setOptions(options) {
  const accessToken = (options.accessToken) ?
    options.accessToken :
    mapboxgl.accessToken;

  mapbox = new MapboxClient(accessToken);

  return {
    type: types.SET_OPTIONS,
    options: options
  };
}

export function hoverMarker(coordinates) {
  return (dispatch) => {
    const feature = (coordinates) ? buildPoint(coordinates, { id: 'hover'}) : {};
    dispatch(setHoverMarker(feature));
  };
}

export function setRouteIndex(routeIndex) {
  return {
    type: types.ROUTE_INDEX,
    routeIndex
  };
}

export function addOrigin(coordinates) {
  return (dispatch, getState) => {
    const { destination, profile, waypoints } = getState();

    const origin = buildPoint(coordinates, {
      id: 'origin',
      'marker-symbol': 'A'
    });

    if (destination.geometry) {
      const query = buildDirectionsQuery(origin, destination, waypoints);
      dispatch(fetchDirections(query, profile));
    }

    dispatch(originPoint(origin));
  };
}

export function addDestination(coordinates) {
  return (dispatch, getState) => {
    const { origin, profile, waypoints } = getState();
    const destination = buildPoint(coordinates, {
      id: 'destination',
      'marker-symbol': 'B'
    });

    if (origin.geometry) {
      const query = buildDirectionsQuery(origin, destination, waypoints);
      dispatch(fetchDirections(query, profile));
    }

    dispatch(destinationPoint(destination));
  };
}

export function setProfile(profile) {
  return (dispatch, getState) => {
    const { origin, destination, waypoints } = getState();

    if (origin.geometry && destination.geometry) {
      const query = buildDirectionsQuery(origin, destination, waypoints);
      dispatch(fetchDirections(query, profile));
    }

    dispatch({
      type: types.DIRECTIONS_PROFILE,
      profile
    });
  };
}

export function reverse() {
  return (dispatch, getState) => {
    const { origin, destination, waypoints, profile } = getState();

    let o = {}, d = {};

    if (destination.geometry) {
      o = Object.assign(destination, {
        properties: {
          id: 'origin',
          'marker-symbol': 'A'
        }
      });
    }

    if (origin.geometry) {
      d = Object.assign(origin, {
        properties: {
          id: 'destination',
          'marker-symbol': 'B'
        }
      });
    }

    dispatch(reverseInputs(o, d));

    if (origin.geometry && destination.geometry) {
      const query = buildDirectionsQuery(o, d, waypoints);
      dispatch(fetchDirections(query, profile));
    }
  };
}

export function reverseInputs(origin, destination) {
  return {
    type: types.REVERSE_INPUTS,
    origin,
    destination
  };
}

export function clearOrigin() {
  return {
    type: types.ORIGIN_CLEAR
  };
}

export function clearDestination() {
  return {
    type: types.DESTINATION_CLEAR
  };
}

// Populates gecode results based on
// a search string typed by the user from
// the origin input element
export function queryOriginInput(query) {
  return (dispatch) => {
    return dispatch(geocode(query, (results) => {
      return dispatch(originResults(query, results));
    }));
  };
}

// Populates gecode results based on
// a search string typed by the user from
// the destination input element
export function queryDestinationInput(query) {
  return (dispatch) => {
    return dispatch(geocode(query, (results) => {
      return dispatch(destinationResults(query, results));
    }));
  };
}

// Populates gecode results and sets the origin object
// based on [lng,lat] coordinates or string passed from `directions.setOrigin`
// or from clicking an origin on the map.
export function queryOrigin(input) {
  return (dispatch) => {
    const query = (typeof input === 'string') ? input : input.join(',');
    return dispatch(geocode(query, (results) => {
      if (!results.length) return;
      const result = results[0];
      dispatch(addOrigin(result.geometry.coordinates));
      return dispatch(originResults(result.place_name, results));
    }));
  };
}

// Populates gecode results and sets the destination object
// based on [lng,lat] coordinates or string passed from `directions.setDestination`
// or from clicking an destination on the map.
export function queryDestination(input) {
  return (dispatch) => {
    const query = (typeof input === 'string') ? input : input.join(',');
    return dispatch(geocode(query, (results) => {
      if (!results.length) return;
      const result = results[0];
      dispatch(addDestination(result.geometry.coordinates));
      return dispatch(destinationResults(result.place_name, results));
    }));
  };
}

export function addWaypoint(waypoint) {
  return (dispatch, getState) => {
    const { origin, destination, waypoints, profile} = getState();

    if (destination.geometry) {
      const query = buildDirectionsQuery(origin, destination, [waypoint, ...waypoints]);
      dispatch(fetchDirections(query, profile));
    }

    dispatch({
      type: types.WAYPOINTS,
      waypoints: [...waypoints, waypoint]
    });
  };
}

export function removeWaypoint(waypoint) {
  return (dispatch, getState) => {
    const { origin, destination, waypoints, profile} = getState();

      const revisedWaypoints = waypoints.filter((way) => {
        return !inProximity(way, waypoint);
      });

      if (destination.geometry) {
        const query = buildDirectionsQuery(origin, destination, revisedWaypoints);
        dispatch(fetchDirections(query, profile));
      }

    dispatch({
      type: types.WAYPOINTS,
      waypoints: revisedWaypoints
    });
  };
}
