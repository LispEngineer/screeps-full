// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

// Spawn handling code
"use strict";
const util = require('util');
const r = require('repair');
const resources = require('resources');
const flag = require('flag');
const bs = require('role.bootstrapper');
const roles = require('roles');

// TODO: Make our spawning sensitive to our power reserve.
// Pretend to have less energy when we have a low power
// reserve, and make smaller creeps.


// Must be a positive power of 10
const SPAWN_ID_DIGITS = 4;
const MAX_SPAWN_ID = Math.pow(10, SPAWN_ID_DIGITS);

const MIN_STORED_ENERGY_FOR_MULTI_ROOM = 20000;

const ROLE_BOOTSTRAPPER = 'bootstrapper';
const DESIRED_BOOTSTRAPPERS = 6;

const FLAG_COLOR_NO_REMOTE = COLOR_RED;
const FLAG_SEC_NO_REMOTE = COLOR_YELLOW;


// Gets the next spawn ID. This is a persistent number that keeps increasing.
function get_next_spawn_id() {
    let next_id = Memory.dpf_spawn_last_id;

    if (next_id == null) { next_id = 0; }
    else { next_id = parseInt(next_id); }
    next_id = (next_id + 1) % MAX_SPAWN_ID;
    Memory.dpf_spawn_last_id = next_id;

    return next_id;
}

// Subtract one from next spawn ID
function revert_spawn_id() {
    let next_id = Memory.dpf_spawn_last_id;

    if (next_id == null) { next_id = 1000; } // Should never happen
    else { next_id = parseInt(next_id); }
    next_id = (next_id - 1) % MAX_SPAWN_ID;
    if (next_id < 0) { next_id += MAX_SPAWN_ID };
    Memory.dpf_spawn_last_id = next_id;

    return next_id;
}


// Clears memory from dead spawns
function clear_memory() {
    // console.log('Clearing dead creeps...');
    // XXX: Remove repair flags from structures serviced by dead creeps.
    for (const name in Memory.creeps) {
        if (!Game.creeps[name]) {
            console.log('Clearing non-existing creep memory: ' + name + ', role: ' + Memory.creeps[name].role + ", birth room: " + Memory.creeps[name].birth_room);
            r.creep_died(name);
            delete Memory.creeps[name];
        }
    }
} // clear_memory


// Uses get_next_spawn_id() to make a creep's name
function make_creep_name(role_name) {
    // If our role has multiple versions, include that in our name
    let role_ver = role_name.substr(-1);
    if (role_ver < "1" || role_ver > "9") {
        role_ver = "";
    }

    let custom_name = role_name.substr(0,4) + role_ver + "-";
    // zero-prefix the name
    let sid = get_next_spawn_id() + MAX_SPAWN_ID;
    custom_name += sid.toString().substr(1, SPAWN_ID_DIGITS);
    // TODO: Keep searching until we find an unused name, or add a suffix.

    return custom_name;
}

// We spawn multi-purpose bootstrap creeps for rooms without
// spawners.
function spawn_bootstrappers(spawn_name) {
    const spawn = Game.spawns[spawn_name];

    if (spawn == null || spawn.spawning) {
        return false;
    }
    if (!spawn.isActive()) {
        // console.log('Not spawning bootstrappers at inactive spawn:', spawn_name);
        return false;
    }

    const room = spawn.room;
    const noRemotes = flag.get_flag_rooms(FLAG_COLOR_NO_REMOTE, FLAG_SEC_NO_REMOTE);
    if (noRemotes.includes(room.name)) {
        // console.log('Not spawning bootstrappers in room', room.name);
        return false;
    }

    // Find rooms we control without spawners
    const controlled_rooms = _.filter(Game.rooms, r => r.controller != null && r.controller.my);
    const unspawnables = _.filter(controlled_rooms,
                                  r => r.find(FIND_MY_SPAWNS).length == 0);
    const needed = unspawnables.length * DESIRED_BOOTSTRAPPERS;
    // console.log('Controlled rooms len:', controlled_rooms.length);
    // console.log('Unspawnables: ', JSON.stringify(unspawnables.map(r => r.name)));

    const creeps = _.filter(Game.creeps, c => c.memory.role == ROLE_BOOTSTRAPPER);
    // console.log('Bootstrappers:', creeps.length, 'needed:', needed); //, JSON.stringify(creeps));

    const target = unspawnables[0];

    // TODO: Count number of bootstrappers in each unspawnable room, and assign
    // each newly spawned one to the specified room.

    if (creeps.length < needed) {
        const custom_name = make_creep_name(ROLE_BOOTSTRAPPER);
        const body = bs.spawn_body(room);

        if (body == null) {
            console.log('Error spawning ' + ROLE_BOOTSTRAPPER + ' at spawn ' + spawn_name + ': no body');
            return false;
        }

        let name = util.create_creep(spawn_name, body, custom_name, ROLE_BOOTSTRAPPER, target.name);
        if (_.isString(name)) {
            console.log(spawn_name + ' spawning bootstrapper for room ' + target + ': ' + name);
            Game.creeps[name].birth_room = target.name;
        } else {
            console.log('Error spawning ' + ROLE_BOOTSTRAPPER + ' at spawn ' + spawn_name + ': ' + util.error_name(name));
            revert_spawn_id();
        }
    }

    return true;
} // spawn_bootstrappers


function all_spawns() {

    // We do this only every three ticks to save CPU
    if ((Game.time % 3) != 2) {
        return;
    }

    // What we're spawning in each room
    let spawn_cache = { multi_room: {} };

    // Order the spawns by the amount of energy in storage for that spawn's room
    const spawn_names = Object.keys(Game.spawns);
    const storage_energy =
        spawn_names.map(sn => resources.summarize_room(Game.spawns[sn].room.name).storage_energy);
    const zipped = _.zip(spawn_names, storage_energy);
    const sorted = zipped.sort(([,a],[,b]) => b - a);
    // console.log(JSON.stringify(sorted));
    // for (const [spawn_name,] of sorted) {
    //     console.log(spawn_name);
    // }

    let spawn_number = 0;
    for (const [spawn_name,] of sorted) {
        if (!Game.spawns[spawn_name].isActive()) {
            // console.log('Not spawning at inactive spawn:', spawn_name);
            continue;
        }
        
        
        // console.log('Spawning at spawn: ' + spawn_name);
        const result = do_spawn(spawn_name, spawn_number, spawn_cache);

        if (_.isString(result)) {
            // Spawned something
        } else if (_.isBoolean(result) && !result) {
            // Error or already spawning
        } else if (_.isNumber(result)) {
            // Spawn error
        } else {
            // Didn't spawn - do a bootstrap check
            spawn_bootstrappers(spawn_name);
        }
        spawn_number++;
    }
}

// Go through each role and see if we need more creeps of that type.
//
// TODO: Have it spawn more if the amount of time it takes to spawn
// a new creep of the desired type is longer than the time left to live
// on the oldest existing one of that type.
//
// Spawn number. How high up the list of spawns we are in terms of
// most energy in storage.
//
// Returns:
//    string: name of the new creep
//    negative number: error when we tried to spawn something
//    false: some other error or we're busy
//    true: we can do something else

function do_spawn(spawn_name, spawn_number, spawn_cache = {}) {

    const spawn = Game.spawns[spawn_name];
    if (spawn == null) {
        console.log('No such spawn: ' + spawn_name);
        return false;
    }

    const room = spawn.room;

    // Do nothing if the game is already spawning
    if (spawn.spawning) {
        // console.log("Already spawning: " + WHERE);
        return false;
    }

    for (let role_name in global.role_info) {
        // Note: hasOwnProperty doesn't seem to be needed despite this:
        // http://stackoverflow.com/questions/8312459/iterate-through-object-properties

        // NOTE: If we schedule multiple creep spawns at the same place,
        // only the last one will take effect, and earlier spawn attempts
        // will still use memory for the new creep name!

        // TODO: Attempt creation of creeps in order of need (i.e., least percentage
        // of desired available.)

        // console.log("Checking role: " + role_name + ' at spawn: ' + spawn.name + ' in room: ' + room);
        const ri = global.role_info[role_name];
        let creeps;
        let cache_loc;
        let desired = roles.get_num_desired(role_name, room);

        if (ri.multi_room) {
            creeps = util.creeps_by_role(role_name);
            cache_loc = ['multi_room', role_name];
        } else {
            creeps = util.creeps_by_role(role_name, room);
            cache_loc = [room.name, role_name];
        }
        const num_creeps = creeps == null ? 0 : creeps.length;
        const num_cached = _.get(spawn_cache, cache_loc, 0);

        let body = null;

        if (!ri.funcs.spawn_body) {
            console.log("Can't create creep with role due to no spawn_body: " + role_name);
            continue;
        }
        body = ri.funcs.spawn_body(room);
        if (body == null) {
            console.log('Not creating creep with role due to no body returned: ' + role_name);
            continue;
        }

        // Figure out if a creep is going to die in as much time as we're going to need
        // to build a replacement, and then build the replacement early.
        const spawn_time = body.length * CREEP_SPAWN_TIME;
        const min_life = _.min(creeps, 'ticksToLive').ticksToLive;
        const creep_dying_adjustment = min_life < spawn_time ? -1 : 0;

        // Should we NOT spawn another creep?
        if (num_creeps + num_cached + creep_dying_adjustment >= desired) {
            continue;
        }

        // If it's a multi-room creep, we only spawn it if we have enough
        // spare energy, or we're the top energy reserve, or it's important,
        // and we haven't banned that room from multi-room/remote creeps
        if (ri.multi_room) {
            const rminfo = resources.summarize_room(room);
            if (spawn_number > 0 &&
                !ri.important &&
                rminfo.storage_energy < MIN_STORED_ENERGY_FOR_MULTI_ROOM) {
                // console.log(spawn_name, 'not spawning mult-room creep', role_name, 'for low energy', rminfo.storage_energy);
                continue;
            }
            const noRemotes = flag.get_flag_rooms(FLAG_COLOR_NO_REMOTE, FLAG_SEC_NO_REMOTE);
            if (noRemotes.includes(room.name) && !ri.important) {
                console.log('Not spawning multi-room creeps in room', role_name, room.name);
                continue;
            }
        }

        let custom_name = make_creep_name(role_name);

        let name = util.create_creep(spawn_name, body, custom_name, role_name);
        if (_.isString(name)) {
            console.log(spawn_name, "spawning", name, ". Have", creeps.length,
                        "of a desired", desired,
                        (ri.multi_room ? "overall" : "per room"),
                        ", using body size:", body.length,
                        (creep_dying_adjustment != 0 ? " before another one dies" : " "));
            // Increment our spawning counter so we don't have two spawners doing
            // the same thing
            _.set(spawn_cache, cache_loc, num_cached + 1);
            return name;
        } else if (name != ERR_NOT_ENOUGH_ENERGY) {
            console.log('Error spawning ' + role_name + ' at spawn ' + spawn_name + ': ' + util.error_name(name));
            // Undo our increment cause we didn't use the name
            revert_spawn_id();
        }

    } // every role

    return true; // We didn't spawn anything
} // spawn


// Critical creeps are assumed all to be on a per-room basis
const CRITICAL_CREEP_ROLES = ['harvester2','transfer','filler'];
const BOOTSTRAP_CREEP_ROLE = 'harvester';
const CHECK_AFTER = 3;
const BOOTSTRAP_AFTER = 300; // We can take upwards of 90 ticks to build replacements
const BOOTSTRAP_CREEP_BODY = [WORK,CARRY,MOVE];
const TEST_MODE = false;

// Emergency spawning code.
// Spawns a WORK CARRY CARRY CARRY MOVE harvester which whole job is to
// harvest and then rebuild our capability to build creeps. It will keep
// spawning these until we have at least one of each of our key post-
// bootstrap creeps, which are currently harvester2, transfer, and filler.
//
// We only kick off if we have less than 1 each of any of these creep types for
// more than X ticks in a row. We also don't run the check except after N ticks
// since the last successful check.
//
// Returns true if we spawned an emergency creep. False on errors or nothing needed.
function emergency_spawn_room(room, spn) {
    const memory_location = ['emergency_spawn', room.name, 'last_positive_tick'];
    const now = Game.time;
    const last_positive_tick = _.get(Memory, memory_location, 0);

    if (last_positive_tick == 0) {
        console.log('Initializing emergency_spawn for room ' + room.name);
        _.set(Memory, memory_location, now);
        return false;
    }

    if (now - last_positive_tick < CHECK_AFTER) {
        // console.log('Skipping emergency spawn check ' + room.name + ' due to recently good tick: ' + last_positive_tick);
        return false;
    }

    const creep_count = CRITICAL_CREEP_ROLES.map(cs => TEST_MODE ? 0 : util.creeps_by_role(cs, room).length);
    const critical_creep_desired =
        CRITICAL_CREEP_ROLES.map(cr => roles.get_num_desired(cr, room));
    // Compare the ones we have to the ones we at least want one of
    const creeps_had_wanted = _.zip(creep_count, critical_creep_desired);
    // console.log(JSON.stringify(creeps_had_wanted));
    const all_positive = creeps_had_wanted.every(have_want => have_want[1] <= 0 || have_want[0] > 0);

    // console.log('Emergency creep spawn check room ' + room.name + ': have everyone? ' + (all_positive ? "Yes" : "No") + ', counts: ' + creep_count);

    if (all_positive) {
        _.set(Memory, memory_location, now);
        return false;
    }

    // Wait and see...
    if (now < last_positive_tick + BOOTSTRAP_AFTER) {
        console.log(room.name, 'spawning emergency harvest creep in',
                    (last_positive_tick - now + BOOTSTRAP_AFTER), 'ticks:',
                    JSON.stringify(_.zip(CRITICAL_CREEP_ROLES, creep_count, critical_creep_desired)));
        return false;
    }

    if (spn.spawning) {
        return false;
    }

    // Crap, we gotta spawn our emergency spawn
    // TODO: Reconsider if we have emergency spawns living? Or just keep spawning more?
    let name = util.create_creep(spn.name, BOOTSTRAP_CREEP_BODY, 'emergency-' + now, BOOTSTRAP_CREEP_ROLE);

    if (_.isString(name)) {
        console.log(room.name + ' spawned emergency harvest creep: ' + name);
        // Reset our timer for seeing when we need another one...
        _.set(Memory, memory_location, now);
        return true;
    } else {
        console.log(room.name, 'failed to spawn emergency harvest creep:', util.error_name(name));
        return false;
    }
} // emergency_spawn

// Goes through each room we have and sees if we need an emergency spawn
function emergency_spawn() {
    for (const room_name in Game.rooms) {
        const room = Game.rooms[room_name];

        if (room.controller == null) {
            continue;
        }
        if (!room.controller.my) {
            continue;
        }
        // console.log('Checking for needed emergency spawn in room: ' + room_name);

        const spawns = room.find(FIND_MY_SPAWNS);
        if (spawns == null || spawns.length == 0) {
            // console.log('No spawns in room: ' + room_name);
            continue;
        }

        /* // We want to check even if we can't spawn.
        let spawn = _.find(spawns, s => !s.spawning);
        if (spawn == null) {
            console.log('No free spawns in room for emergency check: ' + room_name);
            continue;
        }
        */

        let spn = _.find(spawns, s => !s.spawning);
        if (spn == null) {
            // We intentionally still call emergency_spawn_room so that it will
            // do the emergency spawn countdown regardless of having an available
            // spawn.
            spn = spawns[0];
        }
        emergency_spawn_room(room, spn);
    }
} // emergency_spawn_new

// Returns a structure that shows the number of creeps
// needed on a per-room basis
function roles_needed_per_room() {
    let retval = {};

    for (let role_name in global.role_info) {
        const ri = global.role_info[role_name];

        for (let room_name in Game.rooms) {
            const room = Game.rooms[room_name];

            let desired = roles.get_num_desired(role_name, room);

            _.set(retval, [role_name, room_name], desired);
        }
    }

    return retval;
} // roles_needed_per_room

module.exports = {

    // Clears memory from dead spawns
    clear_memory,

    // Go through each role and see if we need more creeps of that type
    do_spawn,
    all_spawns,
    get_next_spawn_id,
    emergency_spawn,

    // Logging/monitoring
    roles_needed_per_room,
};
