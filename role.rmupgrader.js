// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

// Remote upgrader.
// Picks the room with the lowest RCL to upgrade.
// Transits between that one and the one with the
// highest RCL to pull resources from.
// This is only made in the room that has the highest
// RCL.

"use strict";
const util = require('util');
const c = require('creep');
const resources = require('resources');
const upgrader = require('role.upgrader');
const emoji = require('emoji');


// Only spawn these guys if we have at least this much in storage
const REMOTE_UPGRADER_STORAGE = 200000;
// const REMOTE_UPGRADER_STORAGE = 200000;


function spawn_body(room) {
    const ri = resources.summarize_room(room);
    const group = [CARRY, CARRY, WORK, MOVE, MOVE, MOVE];
    const groupPrice = 350;
    const maxGroups = 4;
    const numGroups = Math.min(maxGroups, Math.floor(ri.energy_cap / groupPrice));
    let retval = [];
    for (let i = 0; i < numGroups; i++) {
        retval = retval.concat(group);
    }
    return retval;
} // spawn_body

// Toughened up
function spawn_body_tough(room) {
    const ri = resources.summarize_room(room);

    const group1 = [TOUGH];
    const group2 = [MOVE];
    const groupSize = 2;
    // TODO: Add HEAL
    const base = [MOVE, MOVE, CARRY, WORK];
    const basePrice = 250;
    const groupPrice = 60;
    const numGroups = Math.floor((ri.energy_cap - basePrice) / groupPrice);
    let retval = [];
    let first = [];
    let middle = [];
    let end = [].concat(base);

    for (let i = 0; i < numGroups && retval.length + groupSize < 50; i++) {
        first = first.concat(group1);
        middle = middle.concat(group2);
        retval = first.concat(middle, end);
    }
    // console.log('Remote upgrader body:', JSON.stringify(retval));

    return retval;
} // spawn_body

// Only have one remote upgrader at a time, and then only
// if our highest RCL room has enough energy in storage.
function num_desired(room) {
    // TEMPORARILY DISABLE
    return 0;
    
    const ris = resources.summarize_rooms();
    // const maxRI = _.max(ris, ri => ri.controller_level);
    const maxStorage = _.max(ris, ri => ri.storage_energy);

    // console.log('rmupgrader.num_desired');

    if (maxStorage.room_name == room.name) {
        // console.log('rmupgrader: room ' + room.name + ' is maximum controller level');
        if (maxStorage.storage_energy >= REMOTE_UPGRADER_STORAGE) {
            return 2;
        } else {
            return 0;
        }
    } else {
        return 0;
    }
} // num_desired

// Gets the room to be upgraded: The one with lowest controller level
function get_room_to_upgrade() {
    const ris = resources.summarize_rooms();
    return _.min(ris, ri => ri.owned ? ri.controller_level : Infinity).room_name;
}

// Gets the room to refill in: The one with highest energy storage
function get_room_to_refill() {
    const ris = resources.summarize_rooms();
    return _.max(ris, ri => ri.owned ? ri.storage_energy : 0).room_name;
}

// Harvest energy from our highest level room.
function harvest(creep) {
    const dest_name = get_room_to_refill();

    if (creep.room.name == dest_name) {
        console.log(creep.name + ' in highest room, harvesting');
        upgrader.upgrader_harvest(creep);
    } else {
        console.log(creep.name + ' moving to highest room');
        c.move_to_room_safe(creep, dest_name);
    }
}

function upgrade(creep) {
    const dest_name = get_room_to_upgrade();

    if (creep.room.name == dest_name) { // true = lowest room
        console.log(creep.name + ' in lowest room, upgrading');
        upgrader.upgrader_act(creep);
    } else {
        console.log(creep.name + ' moving to lowest room');
        c.move_to_room_safe(creep, dest_name);
    }
}

function run(creep) {
    if (creep.spawning) {
        return;
    }

    creep.memory.multi_room = true; // Really should just set this once at spawn time
    c.harvest_or_act(creep, harvest, upgrade, null, null);
}

module.exports = {

    run,
    spawn_body,
    num_desired,

};
