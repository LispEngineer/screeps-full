// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

// Programming for defensive creeps.
// Apparently there doesn't need to be any CARRY
// for attack to work.

// We remember where the enemies are, and if our room info with
// that disappears, still go there anyway, until we know for sure
// that there are no enemies there.
// This will cover the case where, for example, an enemy comes into
// a remote harvesting room and kills all our creeps (or they all
// run away) but we then keep sending more creeps there.

// Memory tags
// target_room - where we're going to attack enemies
// last_enemy_tick - when we last saw any enemies

// TODO:
// Don't spawn defenders in rooms where we have towers, the towers have
// at least a few hundred energy, and the enemies in those rooms are Invaders.

"use strict";
const util = require('util');
const c = require('creep');
const resources = require('resources');
const emoji = require('emoji');

/** If we don't see any enemies in this many ticks, go despawn. */
const TICKS_TO_DESPAWN = 50;
const INVADER = 'Invader';

const FRIENDS = ['Calame'];

// We keep 1 MOVE to 1 ATTACK/TOUGH ratio to ensure that these guys can
// move as quickly as creepily possible on non-road, non-swamp
function spawn_body(room) {
    const ri = resources.summarize_room(room);

    const preGroup = [TOUGH]; // 10 cost
    const group = [MOVE, ATTACK, MOVE]; // 50, 80, 50 cost
    const groupPrice = 190;
    const maxGroups = 5;
    const numGroups = Math.min(maxGroups, Math.floor(ri.energy_cap / groupPrice));
    let retval = [];

    for (let i = 0; i < numGroups; i++) {
        retval = preGroup.concat(retval, group);
    }

    return retval;
}

// We want 2 of these per invader across all rooms.
function num_desired(room) {
    const MIN_TOWER_ENERGY = 200;
    const ris = resources.summarize_rooms();
    const myris = _.filter(ris, ri => ri.owned || ri.reserved);
    const enemies = _.sum(myris, 'num_enemies');
    
    if (enemies <= 0) {
        return 0;
    }

    // Determine what kind and where the enemies are.
    // If the enemies are not in rooms we control, ignore them.
    // If the enemies are in rooms we have towers with energy, and are Invaders, ignore them.
    // Otherwise, get 2 * number of enemies.

    // Get rooms with towers and rooms without
    const [towered_rooms, untowered_rooms] =
        _.partition(myris,
            ri => ri.num_towers > 0 && ri.tower_energy / ri.num_towers > MIN_TOWER_ENERGY);
    const towered_invaders = _.sum(towered_rooms, ri => _.get(ri, ['enemies_present', INVADER], 0));

    if (enemies <= towered_invaders) {
        console.log('Not spawning defenders, all enemies are invaders in towered rooms');
        return 0;
    }
    // const non_invaders = _.sum(myris, ri => )

    return 2 * (enemies - towered_invaders);
}

// Finds an enemy room with a creep
// Return value: OK if no enemies or we're moving
// Else an ERR_* code
function move_to_enemy_room(creep) {
    const ris = resources.summarize_rooms();
    const target_room = creep.memory.target_room;
    let dest_name;

    if (target_room != null &&
        (ris[target_room] == null || ris[target_room].num_enemies > 0)) {
        // continue to this room, as we have lost visibility OR it still has enemies
        dest_name = target_room;
    } else {
        // Find a room with enemies if we don't have a destination
        dest_name = _.findKey(ris, ri => ri.num_enemies > 0);
    }

    if (dest_name == null) {
        // No more enemies anywhere
        console.log(creep.name + ' standing down (no enemies seen)');
        delete creep.memory.target_room;
        return OK;
    }

    // Update our memory
    creep.memory.target_room = dest_name;

    return c.move_to_room_safe(creep, dest_name);
} // move_to_enemy_room

// We're in a room with enemies, so kill them.
function defend_room(creep) {
    console.log(creep.name, 'defending room', creep.room.name);
    // const enemies = creep.room.find(FIND_HOSTILE_CREEPS);
    const closest = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS, { filter:
        c => !FRIENDS.includes(c.owner.username) });
    
    if (closest == null) {
        console.log(creep.name, creep.pos, 'Defending but finds no enemies');
        return false;
    }

    const result = creep.attack(closest);
    if (result == ERR_NOT_IN_RANGE) {
        console.log(creep.name + ' moving to attack ' + closest.name + ' at ' + closest.pos);
        creep.moveTo(closest);
    } else if (result == OK) {
        console.log(creep.name + ' attacking ' + closest.name + ' at ' + closest.pos);
    }

    // This shouldn't matter, cause as long as we're alive, we'll have visibility
    // into this target room.
    creep.memory.target_room = creep.room.name;
    return true;
} // defend_room

function defend(creep) {
    const ris = resources.summarize_rooms();

    if (ris[creep.room.name].num_enemies <= 0) {
        move_to_enemy_room(creep);
    } else {
        defend_room(creep);
    }
}

function run(creep) {
    creep.memory.multi_room = true;

    if (creep.spawning) {
        return;
    }

    const ris = resources.summarize_rooms();
    const enemies = _.sum(ris, 'num_enemies');
    const target_room = creep.memory.target_room ? creep.memory.target_room : creep.room.name;
    let all_done = false;

    // Check if we're done defending
    if (enemies <= 0) {
        if (target_room == creep.room.name) {
            // If there are no enemies and we're in the last seen enemy room we're done
            all_done = true;
        } else if (ris[target_room] == null) {
            // We have to keep going to the target room because we no longer have
            // visibility to it.
            all_done = false; // Repetitve
            console.log(creep.name, 'lost visibility into target, moving to attack', target_room);
        } else {
            all_done = true;
        }
    }

    if (all_done) {
        // Have it wait N ticks and then go and despawn.
        if (creep.memory.last_enemy_tick == null) {
            // This should only rarely happen when it spawns after all enemies are dead
            creep.memory.last_enemy_tick = Game.time;
        }
        if (Game.time - creep.memory.last_enemy_tick > TICKS_TO_DESPAWN) {
            c.despawn(creep);
            return;
        }
        console.log(creep.name, 'sees no enemies, despawning in',
                    (TICKS_TO_DESPAWN + creep.memory.last_enemy_tick - Game.time));
        return;
    }

    creep.memory.last_enemy_tick = Game.time;
    defend(creep);
}

module.exports = {

    run,
    spawn_body,
    num_desired,

};
