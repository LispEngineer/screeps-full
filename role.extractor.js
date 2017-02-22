// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

// Mineral extractor.
// Only spawns in rooms with both storage and
// mineral extractors.
// Extracts and then sticks it in storage.

"use strict";
const util = require('util');
const c = require('creep');
const resources = require('resources');
const upgrader = require('role.upgrader');
const emoji = require('emoji');

// For now, just make a small body since it takes 250 ticks to extract a full
// load anyway.
// Note that we can extract as much as we want per tick, but there's a 5 tick
// cooldown no matter what.
function spawn_body(room) {
    const ri = resources.summarize_room(room);

    const group = [WORK, CARRY, MOVE];
    const groupPrice = 200;
    const maxGroups = 5;
    const numGroups = Math.min(maxGroups, Math.floor(ri.energy_cap / groupPrice));
    let retval = [];

    for (let i = 0; i < numGroups; i++) {
        retval = retval.concat(group);
    }

    return retval;
} // spawn_body

// Only have one mineral extractor at a time,
// only if we have storage and an extractor,
// and only if it's got minerals in it.
// Once the minerals are empty, it starts
// a 50,000 tick cooldown before it refills.
function num_desired(room) {
    const ri = resources.summarize_room(room);

    if (ri.has_storage && ri.num_extractors > 0 && ri.mineral_amount > 0) {
        return 1;
    }
    return 0;
} // num_desired

// Harvest minerals from our extractor.
// Returns false if no extractor, true if there is one.
function harvest_mineral(creep) {
    const extractors = creep.room.find(FIND_STRUCTURES, { filter: s => s.structureType == STRUCTURE_EXTRACTOR });
    const extractor = extractors && extractors.length ? extractors[0] : null;
    const minerals = creep.room.find(FIND_MINERALS);
    const mineral = minerals && minerals.length > 0 ? minerals[0] : null;
    const ri = resources.summarize_room(creep.room);

    if (extractor == null) {
        // We should stop harvesting and turn stuff in.
        console.log(creep.name + ' has no extractors to go to.');
        return false;
    }
    // If it's on cooldown, we'll get an error below.
    /*
    if (extractor.cooldown > 0) {
        // Can't harvest while it's on cooldown
        return true;
    }
    */
    // console.log(creep.name + ' harvesting from mineral at ' + mineral.pos);
    // creep.moveTo(mineral);
    // NOTE: You must harvest from the MINERAL not the EXTRACTOR
    const result = creep.harvest(mineral);
    if (result == ERR_NOT_IN_RANGE) {
        creep.moveTo(mineral);
    } else {
        // console.log('... result: ' + result);
    }
    return true;
}

// Deliver our minerals to where they go.
// First, to a terminal for selling, otherwise to storage.
function deliver(creep) {
    // null = all resources
    c.deliver_structure(creep, [STRUCTURE_TERMINAL], null) ||
        c.deliver_structure(creep, [STRUCTURE_STORAGE], null);
}


function run(creep) {
    const RETURN_LIFE = 50;
    const ri = resources.summarize_room(creep.room);

    if (creep.spawning) {
        // console.log(name + ' still spawning');
        return;
    }
    
    if (ri.mineral_amount <= 0 || creep.ticksToLive <= RETURN_LIFE) {
        if (creep.ticksToLive == RETURN_LIFE) {
            console.log(creep.name + ' about to die; returning for final mineral deposit');
        }
        c.dump_and_despawn(creep);
        return;
    }

    c.harvest_or_act(creep, harvest_mineral, deliver, null, null);
}

module.exports = {

    run,
    spawn_body,
    num_desired,

};
