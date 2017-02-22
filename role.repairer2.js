// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

// Repairers first try to repair things that need repair,
// in priority order, and otherwise will try to build things
// and finally try to upgrade room controllers.

// V2 repairers work this way:
// 1. When they start acting, they pick the highest priority thing to
//    repair that doesn't have a repairer working on it
// 2. They mark that they're working on it:
//    a. In their memory
//    b. On the structure ("repairer")
// 3. They work on it until the "needs_repair" flag on its memory
//    goes away OR the structure doesn't exist anymore
// 4. Then they get another one.

"use strict";
const util = require('util');
const c = require('creep');
const r = require('repair');
const emoji = require('emoji');
const resources = require('resources');
const builder = require('role.builder');


// Minimum storage reserve before we start building more repairers
const MINIMUM_STORAGE_FOR_EXTRA_REPAIRERS = 100000;

// Repairs whatever we were repairing, or gets something
// to repair. If we're a multi-room creep, we use our current
// room. Otherwise, we use our birth room.
// Returns true if we acted, false otherwise.
// repair_only (default false) if set will only try to repair.
function repairer2_act(creep, repair_only = false) {
    // rt = repair target
    let rt_id = r.repairing(creep);
    let rt = null;
    
    // console.log('[DEBUG] Creep ' + creep.name + ' rt_id: ' + rt_id);
    
    if (rt_id != null) {
        rt = Game.getObjectById(rt_id);
        // This object no longer exists
        if (rt == null) {
            console.log("Repair target for creep " + creep.name + " no longer exists: " + rt_id);
            // TODO: Clear memory for that object?
            r.set_repairing(creep, null);
            rt_id = null;
        } else if (rt.room.name != creep.room.name) {
            console.log(creep.name, "Repair target for creep no longer in same room", rt_id, creep.room);
            r.set_repairing(creep, null);
            rt_id = null;
        }
    }

    if (rt != null) {
        // See if we need to stop repairing this target
        if (!r.needs_repair(rt.id)) {
            console.log('Creep ' + creep.name + ' done repairing ' + rt.structureType + ' @ ' + rt.pos + ' ' + rt.hits + '/' + rt.hitsMax);
            r.set_repairing(creep, null);
        }
    }
    
    // Find another target to repair
    if (rt == null) {
        // console.log(creep.name, 'getting something to repair');
        // If we operate in multiple rooms, use our current room,
        // otherwise make sure to use only our home room.
        if (creep.memory.multi_room) {
            rt = r.get_next_repair(creep.room.name);
        } else {
            rt = r.get_next_repair(creep.memory.birth_room);
        }
        // console.log(creep.name, 'got something to repair:', JSON.stringify(rt));
        if (rt != null) {
            console.log(creep.name, 'now repairing', rt.structureType, '@', rt.pos, rt.hits, '/', rt.hitsMax);
            r.set_repairing(creep, rt.id);
        }
    }
    
    // Repair our target
    if (rt != null) {
        let ret = creep.repair(rt);
        // console.log('Creep ' + creep.name + ' repairing ' + rt.structureType + ' @ ' + rt.pos + ' ' + rt.hits + '/' + rt.hitsMax + ', ret: ' + ret);
        creep.say(emoji.REPAIR + rt.structureType);
        if (ret == ERR_NOT_IN_RANGE) {
            creep.moveTo(rt);
            return true;
        } else if (ret != OK) {
            console.log(creep.name, 'repairing error', ret);
            return false;
        }
        return true;
    }

    if (repair_only) {
        return false;
    }
    
    // Nothing to repair, so build or deliver to upgrade
    // console.log(creep.name, 'nothing to repair');
    c.build(creep) || c.upgrade_room_controller(creep);
} // repairer2_act

// What to do when we're starting to act
function repairer2_start_harvesting(creep) {
    // Stop repairing whatever we were repairing
    r.set_repairing(creep, null);
}

function run(creep) {
    c.harvest_or_act(creep, builder.builder_harvest, repairer2_act,
                     repairer2_start_harvesting, null, false); // Use energy carry only
} //  harvester_action_run

// Get as many WORK, CARRY, MOVE as we can fit
// within our energy capacity.
// NOTE: Make this sensitive to the available energy reserves in storage,
// and make smaller ones when we have low reserves.
function spawn_body(room) {
    const ri = resources.summarize_room(room);
    const energyCap = ri.energy_cap;

    const groupCost = 200;
    const group = [CARRY, WORK, MOVE];
    const maxGroups = 5;
    const numGroups = Math.min(maxGroups, Math.floor(energyCap / groupCost));
    let retval = [];

    // We ignore the energyAvail
    for (let i = 0; i < numGroups; i++) {
        retval = retval.concat(group);
    }
    // console.log('repairer2 body ' + retval + ", numgroups: " + numGroups);
    return retval;
} // spawn_body


// How many of repairers are desired in the specified room?
// 1. Two if we have no storage
// 2. One if we have storage but not much of a reserve
// 3. Two if we have a reasonable storage reserve
// 4. Two if we hvae enemies present
function num_desired(room) {
    const ri = resources.summarize_room(room);

    if (!ri.has_storage) {
        return 2;
    }
    if (ri.num_enemies > 0) {
        return 2;
    }
    if (ri.storage_energy < MINIMUM_STORAGE_FOR_EXTRA_REPAIRERS) {
        return 1;
    } else {
        return 2;
    }
} // num_desired


module.exports = {
    
    run,
    spawn_body,
    num_desired,

    // For other roles to use
    repairer2_act,

};
