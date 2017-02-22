// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

"use strict";
const util = require('util');
const c = require('creep');
const emoji = require('emoji');
const resources = require('resources');
const flag = require('flag');

const THIS_ROLE = 'claimer';


// Memory
// claim_room
// home_room
// claiming
// initialized
// acting
// multi_room

const FLAG_COLOR_CLAIM = COLOR_YELLOW;
const FLAG_SEC_CLAIM = COLOR_WHITE;

// What to do when we're harvesting
function builder_harvest(creep) {
    // Try to get stuff from storage first, but if not,
    // then get it from our usual source
    // TODO: Allow this to get from containers if we have no storage yet...
    if (!c.reload_energy(creep, [STRUCTURE_STORAGE])) {
        c.harvest(creep);
    }
}

function builder_act(creep) {
    c.build(creep, true) || c.upgrade_room_controller(creep);
}


// Sets up stuff about us when we're created
function initialize(creep) {
    if (creep.memory.initialized) {
        return;
    }
    if (creep.spawning) {
        return;
    }

    creep.memory.home_room = creep.pos.roomName;
    creep.memory.claim_room = null;
    creep.memory.claiming = false;
    creep.memory.initialized = true;
}


function is_room_claimed(roomName) {
    const room = Game.rooms[roomName];

    if (room == null || room.controller == null) {
        return false;
    }

    return room.controller.my;
} // is_room_claimed

function move_to_claim(creep) {
    const room = creep.memory.claim_room;

    creep.memory.multi_room = true;

    if (creep.pos.roomName != room) {
        c.move_to_room_safe(creep, room);
        return;
    }

    // We're in the right room.
    if (!is_room_claimed(room)) {
        const success = creep.claimController(creep.room.controller);
        if (success == ERR_NOT_IN_RANGE) {
            creep.moveTo(creep.room.controller, { maxRooms: 1 });
            creep.say(emoji.MOVE + 'controller');
        } else if (success == OK) {
            creep.say('claiming');
        } else {
            console.log(creep.name + ' claiming: ' + success);
        }
    } else {
        const success = creep.upgradeController(creep.room.controller);
        if (success == ERR_NOT_IN_RANGE) {
            creep.moveTo(creep.room.controller, { maxRooms: 1 });
            creep.say(emoji.MOVE + 'controller');
        } else if (success == OK) {
            creep.say('upgrading');
        } else {
            console.log(creep.name + ' upgrading: ' + success);
        }
    }
}


function harvest_or_claim(creep) {
    c.harvest_or_act(creep, builder_harvest, move_to_claim, null, null);
}

function run(creep) {

    initialize(creep);

    if (creep.memory.claim_room == null) {
        creep.memory.claim_room = get_room_assignment();
        if (creep.memory.claim_room != null) {
            console.log(creep.name, 'assigned to claim room', creep.memory.claim_room);
        }
    }

    if (creep.memory.claim_room != null) {
        if (!creep.memory.claiming) {
            // Start out with a full load of harvest
            creep.memory.acting = false;
            creep.memory.claiming = true;
            console.log(creep.name, 'switching to claiming mode');
        }
        harvest_or_claim(creep);
    } else {
        console.log(creep.name, 'needs a room to claim');
        c.harvest_or_act(creep, builder_harvest, builder_act, null, null);
    }
} //  harvester_action_run



// Get as many WORK, CARRY, MOVE as we can fit
// within our energy capacity.
// NOTE: Make this sensitive to the available energy reserves in storage,
// and make smaller ones when we have low reserves.
function spawn_body(room) {
    const ri = resources.summarize_room(room);
    const energyCap = ri.energy_cap;

    const base = [MOVE, MOVE, WORK, CLAIM];
    const baseCost = 800;
    const groupCost = 100;
    const group = [CARRY, MOVE];
    const maxGroups = 5; // To get it to level 1
    const numGroups = Math.min(maxGroups, Math.floor((energyCap - baseCost) / groupCost));
    let retval = base;

    // We ignore the energyAvail
    // Put our claimer at the very end
    for (let i = 0; i < numGroups; i++) {
        retval = group.concat(retval);
    }
    return retval;
} // spawn_body


// Looks for flags which tell me which rooms we should be harvesting.
function get_rooms_to_claim() {
    return flag.get_flag_rooms(FLAG_COLOR_CLAIM, FLAG_SEC_CLAIM, true);
} // get_rooms_to_repair



// We want one for each room that isn't yet claimed.
function num_desired(room_ignored) {
    let claim_rooms = get_rooms_to_claim();

    claim_rooms = _.filter(claim_rooms, cr => !util.is_room_claimed(cr));

    return claim_rooms.length;
}


// Tells us what room this creep should be assigned to.
function get_room_assignment() {
    let desired_room = flag.assign_room(get_rooms_to_claim(), r => 1,
                                        THIS_ROLE, 'claim_room');

    if (desired_room == null) {
        console.log('claimer could not find a room to assign!');
    }

    return desired_room;
} // get_room_assignment


module.exports = {
    run,
    spawn_body,
    num_desired,
};
