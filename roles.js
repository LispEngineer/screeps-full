// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

// Handles high-level configuration of all our roles,
// and tick execution of creeps with roles.
"use strict";
const c = require('creep');
const emoji = require('emoji');
const stats = require('screepsplus');
const flag = require('flag');
const util = require('util');

// Add our statistics callback
stats.add_stats_callback(add_desired_stats);


// ROLES -------------------------------------------------------

/** The functions a role can have.
 *
 * @typedef {RoleFunctions}
 * @param {function} run(creep)
 * @param {function} num_desired(room) - can be null, or returns the number we want in this room
 * @param {function} spawn_body(room) - can be null, or returns the body to build
 */

/** The configuration for a role. If any property is missing, it should
 * be considered as false/0/null.
 *
 * @typedef {Object} RoleSettings
 * @param {RoleFunctions} funcs - The functions that can be called for this role
 * @param {number} desired - The default number of creeps desired (per room or overall)
 * @param {boolean} multi_room - If this creep is limited to its spawn room or moves between rooms
 * @param {boolean} important - If this creep is multi-room, whether it is limited to available energy reserves
 *                              or not (which defenders shouldn't be subject to)
 * @param {boolean} ok_container - OK if this guy stands on a container perpetually
 */

/** Simple function that requires a specified role's file */
function R(r) { return require('role.' + r); }

/** General configuration for our roles.
 *
 * @type {Object<string, RoleSettings>}
 */
const ROLE_INFO = {
    'harvester2':   { funcs: R('harvester2'),   desired: 2, ok_container: true },
    'transfer'  :   { funcs: R('transfer'),     desired: 1 },
    'filler'    :   { funcs: R('filler'),       desired: 2 },
    'defender'  :   { funcs: R('defender'),     desired: 0, multi_room: true, important: true },
    // Harvesters are necessary until we have harvester2s, transferers and fillers,
    // and some way of bootstrapping ourselves. So, we keep the harvester in the
    // list
    'harvester' :   { funcs: R('harvester'),    desired: 0 },
    'reserver'  :   { funcs: R('reserver'),     desired: 1, multi_room: true },
    'claimer'   :   { funcs: R('claimer'),      desired: 0, multi_room: true },
    'repairer2' :   { funcs: R('repairer2'),    desired: 2 },
    // Don't really need builders cause repairers will build too.
    'builder'   :   { funcs: R('builder'),      desired: 1 },
    'extractor':    { funcs: R('extractor'),    desired: 1 },
    'rmupgrader':   { funcs: R('rmupgrader'),   desired: 0, multi_room: true },
    'upgrader':     { funcs: R('upgrader'),     desired: 1 },
    'termxfer':     { funcs: R('termxfer'),     desired: 0 },
    // Add remote repairers once our roads run down remotely.
    'rmrepair2' :   { funcs: R('rmrepair2'),    desired: 1, multi_room: true },
    'retriver' :    { funcs: R('retriver'),     desired: 0, multi_room: true },
    'rmharvester':  { funcs: R('rmharvester'),  desired: 0, multi_room: true },
    // Remote repair v1 is deprecated
    'rmrepair':     { funcs: R('rmrepair'),     desired: 0, multi_room: true },
    // Bootstrappers do building and upgrading, but are always spawned specially
    'bootstrapper': { funcs: R('bootstrapper'), desired: 0, multi_room: true },
    // Repariers are deprecated
    'repairer':     { funcs: R('repairer'),     desired: 0 },
};
global.role_info = ROLE_INFO;

function init() {
    if (global.role_info == null) {
        console.log('Severe error with global.role_info');
    }
} // init

// Get idle creeps to move off roads
// if (inIdleState && creep.pos.findAt(FIND_ROAD, creep.pos)){creep.move(_.random(1,8);}


// Gets the number of desired creeps.
function get_num_desired(role_name, room) {
    const num_override = flag.get_desired_override(room.name, role_name);
    const ri = global.role_info[role_name];
    let desired = ri.desired;

    // If we have a per-room number of desired function, use that
    if (num_override != null) {
        desired = num_override;
        // console.log('Overridden desired for room/role is', room.name, role_name, num_override);
    } else if (ri.funcs.num_desired != null) {
        desired = ri.funcs.num_desired(room);
        // console.log('Number of ' + role_name + ' desired for room ' + room.name + ' is: ' + desired);
    }

    return desired;
}



function find_controlled_room() {
    let firstRoom = null;

    for (const r in Game.rooms) {
        const rm = Game.rooms[r];
        // Find the best room that we own and go back
        if (rm.controller != null && rm.controller.my) {
            if (firstRoom == null) {
                firstRoom = rm;
            } else if (firstRoom.controller.level < rm.controller.level) {
                firstRoom = rm;
            }
        }
    }

    return firstRoom;
} // find_controlled_room()

const MAX_STANDING_ON_CONTAINER = 10;

// This creep shouldn't stand on a container for too long.
// Returns true if we are moving off a container.
function standing_on_container(creep) {
    const ticks_on_container = _.get(creep.memory, 'standing_on_container', 0);
    const here = creep.pos.look();
    const has_container = _.any(here, x => x.type == 'structure' && x.structure.structureType == STRUCTURE_CONTAINER);

    if (!has_container) {
        delete creep.memory.standing_on_container;
        return false;
    }
    creep.memory.standing_on_container = ticks_on_container + 1;
    if (ticks_on_container > MAX_STANDING_ON_CONTAINER) {
        // Move in some random direction
        console.log(creep.name, 'trying to get off container', creep.pos);
        creep.say(emoji.ERROR + 'container');
        creep.move(Game.time % 8 + 1);
        return true;
    }
    return false;
} // standing_on_container

// Goes through each creep and executes their role's
// run stuff.
// For now, since we're a 1-room player, we also
// make sure to pull any creeps back into their home room.
function run_creeps_by_role() {
    for (const name in Game.creeps) {

        const creep = Game.creeps[name];
        const role = creep.memory.role;
        const role_info = global.role_info[role];

        if (creep.spawning) {
            // Don't do things when creeps are spawning
            continue;
        }

        // TODO: Allow picking up to be prevented by role_info configuration,
        // especially for creeps like extractors.
        c.pickup_adjacent(creep);

        // for (const resourceType in creep.carry) {
        //     if (resourceType != RESOURCE_ENERGY) {
        //         creep.drop(resourceType);
        //     }
        // }

        // Check standing on a container for too long
        if (!role_info.ok_container && standing_on_container(creep)) {
            continue;
        }

        // TODO: If the creep is about to die, put it in a different mode
        // and have it do "near death" things like final deliveries of
        // energy and stuff.

        // If the creep isn't in a room I control, go back to one I do control.
        // console.log(creep.name + ' multi-room: ' + creep.memory.multi_room);
        if (!creep.memory.multi_room) {
            let home_room = Game.rooms[creep.memory.birth_room];

            if (home_room == null) {
                home_room = find_controlled_room();
            }

            if (creep.room.name != home_room.name) {
                console.log(creep.name + ' got lost in room ' + creep.room + ', going back to home room ' + home_room);
                let result = creep.moveTo(home_room.controller, { reusePath: 20, range: 5 });
                // let result = c.move_to_room_safe(creep, home_room.name);
                if (result != OK) {
                    console.log(creep.name + ' returning to room ' + home_room + ' error: ' + util.error_name(result));
                }
                continue;
            }
        }

        if (role_info == null) {
            console.log('Unknown role: ' + role);
        } else {
            try {
                role_info.funcs.run(creep);
            } catch (e) {
                console.log('Exception running role', role, JSON.stringify(e));
            }
        }
    }
} // run_creeps_by_role

// Returns object like this:
// { roomName: { roleName: numberDesired, ...}, ...}
function desired_creeps_per_room() {
    const spawn_rooms = new Set(_.map(Game.spawns, s => s.pos.roomName));
    let retval = {};

    // console.log('Spawn rooms:', JSON.stringify(Array.from(spawn_rooms)));

    for (const room_name of spawn_rooms) {
        const room = Game.rooms[room_name];
        retval[room_name] = { desired: {} };

        for (const role in ROLE_INFO) {
            const ri = ROLE_INFO[role];

            if (ri.multi_room) {
                continue;
            }

            let num_desired = ri.desired;

            if (ri.funcs.num_desired) {
                num_desired = ri.funcs.num_desired(room);
            }

            // console.log(room, role, num_desired);
            retval[room_name].desired[role] = num_desired;
        }
    }

    // console.log(JSON.stringify(retval));
    return retval;
} // desired_creeps_per_room

// screepsplus stats callback
function add_desired_stats(s) {
    const cpm = desired_creeps_per_room();

    const result = _.merge(s.roomSummary, cpm);
    // console.log(JSON.stringify(result), null, 2);
} // add_desired_stats()



module.exports = {
    init,
    run_creeps_by_role,
    desired_creeps_per_room,
    add_desired_stats,
    get_num_desired,
};
