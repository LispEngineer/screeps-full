// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

// Code that tracks the number of events that occur

"use strict";
const stats = require('screepsplus');

// Add our statistics callback
stats.add_stats_callback(add_event_stats);

let events = {};


// screepsplus stats callback
function add_event_stats(s) {
    s.events = events;
} // add_desired_stats()


function reset_events() {
    events = {};
}

// An event to log. The key should be an array of selectors,
// such as ['tower','repair'] or ['creep','harvest'] or whatever.
// If it's just a string, that's fine too.
function add_event(key) {
    if (_.isString(key)) {
        key = [key];
    } else if (!_.isArray(key)) {
        return;
    }
    _.set(events, key, _.get(events, key, 0) + 1);
}

function get_events() {
    return events;
}

module.exports = {
    reset_events,
    add_event,
    get_events
};
