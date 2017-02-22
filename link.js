// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

// Link-processing code.
//
// The game player needs to set up some things in memory
// for this to be useful.


// Memory locations
// All these are underneath: links[id]
// source - boolean indicating if we are the source of sending
//          to other links (if false, we're a target)
// TODO: no_fill - fillers shouldn't fill this, only remote harvesters, etc.
// target_ids - Array of IDs where we send energy to

// How this works:
// 1. Do nothing:
//    a. If we're a target.
//    b. We're a source and on cooldown.
//    c. We have less than our minimum transfer amount
// 2. Limits:
//    a. We have a minimum amount we'll transfer, so do nothing if we have less that
//       that minimum in our reserves OR the target needs less than that minimum
//       (after accounting for the 3% energy loss).
// 3. For each source:
//    a. For each target:
//       *. Get the amount in the target
//       *. If it needs less than our minimum, skip it
//       *. Transfer that amount to that target

"use strict";
let util = require('util');

const ENERGY_LOSS = 0.03;
const MIN_ENERGY_TRANSFER = 200;

// MEMORY ---------------------------------------

// Initialize Memory at module load time
/*
// NOT NECESSARY if we use _.get and _.set
if (Memory.links == null) {
    Memory.links = {};
}
*/

// Returns a string ID for this link,
// regardless of whether it already is a
// string ID or a StructureLink object.
// If it's not a StructureLink, we return null.
function make_link_id(link) {
    if (typeof link == 'string') {
        // TODO: Validate that we really have a link with this ID?
        return link;
    }
    if (link instanceof StructureLink) {
        return link.id;
    }
    return null;
} // link_id

// Always return a boolean (or null)
// True if this link is marked as a source;
// Will return null if the source property is not set.
function is_source(link) {
    const link_id = make_link_id(link);

    if (link_id == null) {
        return false;
    }
    // TODO: Protect against nulls or undefineds
    // Example: _.get(Memory, ['creeps', 'repa2-8018', 'role'], 'fool')
    const retval = _.get(Memory, ['links', link_id, 'source'], null);

    if (retval == null) {
        return null;
    } else {
        return retval ? true : false; // Coerce to boolean
    }
} // is_source

// Sets whether this link is a source
function set_source(link, is) {
    const link_id = make_link_id(link);

    if (link_id == null) {
        return;
    }
    // Coerce to boolean
    // Memory.links[link_id].source = is ? true : false;
    _.set(Memory, ['links', link_id, 'source'], is ? true : false);
} // set_source


// Always return a boolean (or null)
// True if this link is marked as a source;
// Will return null if the source property is not set.
function is_nofill(link) {
    const link_id = make_link_id(link);

    if (link_id == null) {
        return false;
    }
    // TODO: Protect against nulls or undefineds
    // Example: _.get(Memory, ['creeps', 'repa2-8018', 'role'], 'fool')
    const retval = _.get(Memory, ['links', link_id, 'nofill'], null);

    if (retval == null) {
        return null;
    } else {
        return retval ? true : false; // Coerce to boolean
    }
} // is_nofill

// Sets whether this link is a source
function set_nofill(link, is) {
    const link_id = make_link_id(link);

    if (link_id == null) {
        return;
    }
    // Coerce to boolean
    // Memory.links[link_id].source = is ? true : false;
    _.set(Memory, ['links', link_id, 'nofill'], is ? true : false);
} // set_nofill





// Finds all links in the room specified as a target and
// sends energy to them if we have enough energy.
function do_source_link(link, links) {
    // Find all targets in this room with energy to spare
    const targets = _.filter(links,
                             l => l.pos.roomName == link.pos.roomName &&
                                  !is_source(l) &&
                                  l.energy < (l.energyCapacity - MIN_ENERGY_TRANSFER * (1.0 - ENERGY_LOSS)))
                     .sort((a, b) => b.energy - a.energy);

    if (targets.length == 0) {
        // console.log('Nothing for link ' + link.id + ' to fill.');
        return;
    }

    // console.log('Possible targets: ' + targets.map(l => l.id + ':' + l.energy));

    const target = targets[0];

    const needed = target.energyCapacity - target.energy;
    // const neededBeforeLoss = Math.floor(needed * (1.0 / (1.0 - ENERGY_LOSS)));
    // const neededAfterLoss = Math.floor(needed * (1.0 - ENERGY_LOSS));
    const send = Math.min(link.energy, needed); // neededBeforeLoss);

    const result = link.transferEnergy(target, send);
    // console.log('Sending ' + send + ' of ' + neededBeforeLoss + ' (' + needed + ' after loss) to ' + target.id +
    //             ': result ' + result);
    console.log('Link', link.id.substr(-6), link.room.name, 'sending',  send,
                // + ' of ' + neededBeforeLoss +
                // ' (' + neededAfterLoss + ' after loss) '
                'to', target.id.substr(-6), ': result', result);

    // TODO: Log stuff when result is an error?

} // do_source_link


// Calls do_source_link on all source links.
// Warns on any unconfigured links (with source/target not set)
function do_links() {
    const links = _.filter(util.all_structures(), l => l.structureType == STRUCTURE_LINK && l.my);

    // console.log('Found links: ' + links.map(l => l.id));

    for (let link of links) {
        // console.log('Processing link ' + link.id);
        let source = is_source(link);
        if (source == null) {
            console.log('Link needs configuration:', link.id, 'at', link.pos);
        }
        if (!source) {
            continue;
        }
        if (link.energy < MIN_ENERGY_TRANSFER) {
            // console.log('Link awaiting more energy: ' + link.id.substr(-6));
            continue;
        }
        if (link.cooldown > 0) {
            // console.log('Link awaiting cooldown for ' + link.cooldown + ' ticks: ' + link.id);
            continue;
        }

        do_source_link(link, links);

    } // All links
} // do_links


module.exports = {

    do_links,

    // Accessors on Memory.links
    is_source,
    set_source,
    is_nofill,
    set_nofill,

};
