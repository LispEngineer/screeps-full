// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

// Tower functionality
//
// TODO: Make the towers attack creeps with most healing capability first

"use strict";
const util = require('util');
const e = require('events');
const rep = require('repair');

const ROAD_REPAIR_PCT = 0.95;
// Don't repair things unless we have this much energy
const REPAIR_ENERGY_PCT = 0.66;
// How far do we heal new ramparts?
const RAMPART_MIN_HITS = 10000;

const FRIENDS = ['Calame'];

// TODO: Add healing
//
// TODO: Track targets we attack. If their health isn't going down then stop
// targeting them. We should also target creeps with HEAL body parts first.

function do_towers() {
    
    let otherRepairTargets = [];
    let healTargets = [];
    
    let towers = util.all_structures();
    towers = _.filter(towers, (t) => { return t.structureType == STRUCTURE_TOWER && t.my; });

    for (let i = 0; i < towers.length; i++) {
        let t = towers[i];

        if (!t.isActive()) {
            // console.log('Tower', t.id.substr(-6), 'is inactive in room', t.room.name);
            continue;
        }
        
        if (t.energy <= 0) {
            console.log('Tower', t.id.substr(-6), 'out of energy in room', t.pos);
            continue;
        }

        // TODO: Focus fire first on creeps with healing then the most damaged
        let closestHostile = t.pos.findClosestByRange(FIND_HOSTILE_CREEPS, { filter:
            c => !FRIENDS.includes(c.owner.username) });
        if (closestHostile) {
            console.log('Tower', t.id.substr(-6),
                        'attacking hostile', closestHostile.id, closestHostile.owner.username,
                        'in room', t.room.name);
            if (t.attack(closestHostile) == OK) {
                e.add_event(['tower','attack']);
            }
            continue;
        }
        
        // Rampart emergency repairs
        let damagedStructures = t.room.find(FIND_STRUCTURES, {
            filter: (structure) => (structure.hits < RAMPART_MIN_HITS) &&
                (structure.structureType == STRUCTURE_RAMPART) &&
                (!otherRepairTargets.includes(structure.id)) &&
                !rep.should_not_repair(structure.pos)
        });
        let mostDamaged = damagedStructures.sort((a, b) => a.hits - b.hits);
        if (mostDamaged.length > 0) {
            let target = mostDamaged[0];
            console.log('Tower', t.id.substr(-6), 'repairing', target.structureType,
                        'at', target.pos, 'with hits:', target.hits);
            if (t.repair(target) == OK) {
                e.add_event(['tower','repair']);
            }
            otherRepairTargets.push(target.id);
            continue;
        }

        // Heal creeps that are damaged
        const damagedCreeps = t.room.find(FIND_MY_CREEPS,
            { filter: c => c.hits < c.hitsMax &&
                           !healTargets.includes(c.id) });
        if (damagedCreeps.length > 0) {
            const target = damagedCreeps[0];
            console.log('Tower', t.id.substr(-6), 'healing', target.name,
                        'at', target.pos, 'with hits:', target.hits, 'of max:', target.hitsMax);
            if (t.heal(target) == OK) {
                e.add_event(['tower','heal']);
            }
            healTargets.push(target.id);
        }
        
        if (t.energy < t.energyCapacity * REPAIR_ENERGY_PCT) {
            // Don't repair stuff below this energy level - save it for attacking
            continue;
        }

        // console.log('Tower ' + t.id.substr(-6) + ' standing down');

        // We repair stuff only every third tick
        if (Game.time % 3 == 0) {
            continue;
        }

        let closestDamagedStructure = t.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (structure) => (structure.hits < structure.hitsMax * ROAD_REPAIR_PCT) && 
                                   (structure.structureType == STRUCTURE_ROAD) &&
                                   (!otherRepairTargets.includes(structure.id)) &&
                                   !rep.should_not_repair(structure.pos)
        });
        if (closestDamagedStructure) {
            console.log('Tower', t.id.substr(-6), 'repairing', closestDamagedStructure.structureType,
                        'at', closestDamagedStructure.pos, 'with hits:', closestDamagedStructure.hits);
            if (t.repair(closestDamagedStructure) == OK) {
                e.add_event(['tower','repair']);
            }
            otherRepairTargets.push(closestDamagedStructure.id);
            continue;
        }

    }
    
} // do_towers


module.exports = {
    
    do_towers,

};
