import Geocoder from './geocoder';
import template from 'lodash.template';
import isEqual from 'lodash.isequal';
import extent from 'turf-extent';

let fs = require('fs'); // substack/brfs#39
// let tmpl = template(fs.readFileSync(__dirname + '/../templates/inputs.html', 'utf8'));
let tmpl = `<div class='mapbox-directions-component mapbox-directions-inputs'>
  <div class='mapbox-directions-component-keyline'>
    <div class='mapbox-directions-origin'>
      <label class='mapbox-form-label'>
        <span class='directions-icon directions-icon-depart'></span>
      </label>
      <div id='mapbox-directions-origin-input'></div>
    </div>

    <button
      class='directions-icon directions-icon-reverse directions-reverse js-reverse-inputs'
      title='Reverse origin &amp; destination'>
    </button>

    <div class='mapbox-directions-destination'>
      <label class='mapbox-form-label'>
        <span class='directions-icon directions-icon-arrive'></span>
      </label>
      <div id='mapbox-directions-destination-input'></div>
    </div>
  </div>

  <% if (controls.profileSwitcher) { %>
  <div class='mapbox-directions-profile mapbox-directions-component-keyline mapbox-directions-clearfix'><input
      id='mapbox-directions-profile-driving-traffic'
      type='radio'
      name='profile'
      value='mapbox/driving-traffic'
      <% if (profile === 'mapbox/driving-traffic') { %>checked<% } %>
    />
    <label for='mapbox-directions-profile-driving-traffic'>Traffic</label>
    <input
      id='mapbox-directions-profile-driving'
      type='radio'
      name='profile'
      value='mapbox/driving'
      <% if (profile === 'mapbox/driving') { %>checked<% } %>
    />
    <label for='mapbox-directions-profile-driving'>Driving</label>
    <input
      id='mapbox-directions-profile-walking'
      type='radio'
      name='profile'
      value='mapbox/walking'
      <% if (profile === 'mapbox/walking') { %>checked<% } %>
    />
    <label for='mapbox-directions-profile-walking'>Walking</label>
    <input
      id='mapbox-directions-profile-cycling'
      type='radio'
      name='profile'
      value='mapbox/cycling'
      <% if (profile === 'mapbox/cycling') { %>checked<% } %>
    />
    <label for='mapbox-directions-profile-cycling'>Cycling</label>
  </div>
  <% } %>
</div>
`
/**
 * Inputs controller
 *
 * @param {HTMLElement} el Summary parent container
 * @param {Object} store A redux store
 * @param {Object} actions Actions an element can dispatch
 * @param {Object} map The mapboxgl instance
 * @private
 */
export default class Inputs {
  constructor(el, store, actions, map) {
    const { originQuery, destinationQuery, profile, controls } = store.getState();

    el.innerHTML = tmpl({
      originQuery,
      destinationQuery,
      profile,
      controls
    });

    this.container = el;
    this.actions = actions;
    this.store = store;
    this._map = map;

    this.onAdd();
    this.render();
  }

  animateToCoordinates(mode, coords) {
    const { origin, destination, routePadding } = this.store.getState();
    
    if (origin.geometry &&
        destination.geometry &&
        !isEqual(origin.geometry, destination.geometry)) {
      // Animate map to fit bounds.
      const bb = extent({
        type: 'FeatureCollection',
        features: [origin, destination]
      });

      this._map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], {padding: routePadding});
    } else {
      this._map.flyTo({ center: coords });
    }
  }

  onAdd() {
    const {
      clearOrigin,
      clearDestination,
      createOrigin,
      createDestination,
      setProfile,
      reverse
    } = this.actions;

    const { geocoder, accessToken, flyTo, placeholderOrigin, placeholderDestination, zoom } = this.store.getState();

    this.originInput = new Geocoder(Object.assign({}, {
      accessToken
    }, geocoder, {flyTo, placeholder: placeholderOrigin, zoom}));

    const originEl = this.originInput.onAdd(this._map);
    const originContainerEl = this.container.querySelector('#mapbox-directions-origin-input');
    originContainerEl.appendChild(originEl);

    this.destinationInput = new Geocoder(Object.assign({}, {
      accessToken
    }, geocoder, {flyTo, placeholder: placeholderDestination, zoom}));

    const destinationEl = this.destinationInput.onAdd(this._map);
    this.container.querySelector('#mapbox-directions-destination-input').appendChild(destinationEl);

    this.originInput.on('result', (e) => {
      const coords = e.result.center;
      createOrigin(coords);
      this.animateToCoordinates('origin', coords);
    });

    this.originInput.on('clear', clearOrigin);

    this.destinationInput.on('result', (e) => {
      const coords = e.result.center;
      createDestination(coords);
      this.animateToCoordinates('destination', coords);
    });

    this.destinationInput.on('clear', clearDestination);

    // Driving / Walking / Cycling profiles
    const profiles = this.container.querySelectorAll('input[type="radio"]');
    Array.prototype.forEach.call(profiles, (el) => {
      el.addEventListener('change', () => {
        setProfile(el.value);
      });
    });

    // Reversing Origin / Destination
    this.container
      .querySelector('.js-reverse-inputs')
      .addEventListener('click', () => {
        const { origin, destination } = this.store.getState();
        if (origin) this.actions.queryDestination(origin.geometry.coordinates);
        if (destination) this.actions.queryOrigin(destination.geometry.coordinates);
        reverse();
      });
  }

  render() {
    this.store.subscribe(() => {
      const {
        originQuery,
        destinationQuery,
        originQueryCoordinates,
        destinationQueryCoordinates
      } = this.store.getState();

      if (originQuery) {
        this.originInput.query(originQuery);
        this.actions.queryOrigin(null);
      }

      if (destinationQuery) {
        this.destinationInput.query(destinationQuery);
        this.actions.queryDestination(null);
      }

      if (originQueryCoordinates) {
        this.originInput.setInput(originQueryCoordinates);
        this.animateToCoordinates('origin', originQueryCoordinates);
        this.actions.queryOriginCoordinates(null);
      }

      if (destinationQueryCoordinates) {
        this.destinationInput.setInput(destinationQueryCoordinates);
        this.animateToCoordinates('destination', destinationQueryCoordinates);
        this.actions.queryDestinationCoordinates(null);
      }
    });
  }
}
