// Copyright © 2017 Douglas P. Fields, Jr. All Rights Reserved.
// Web: https://symbolics.lisp.engineer/
// E-mail: symbolics@lisp.engineer
// Twitter: @LispEngineer

// Terminal and Market-related functions.
"use strict";
const util = require('util');

// Function from WarInternal
// Sell the specified resource from the specified room
function sell(room_name, resource, amt = Infinity) {
    // 9-30-2016 patch makes this way faster I guess?
    let orders = Game.market.getAllOrders({type: ORDER_BUY, resourceType: resource});
    orders = _.filter(orders, o => o.price >= 0.05 && o.remainingAmount >= 100);
    let order = _.max(orders, o => o.price / Game.market.calcTransactionCost(amt, room_name, o.roomName));
    if (!order || order == Infinity) {
        console.log('No possible order for this sale', room_name, resource);
        return;
    }
    console.log('Chosen order:', JSON.stringify(order));
    if (amt > order.remainingAmount) {
        amt = order.remainingAmount;
    }
    let tc = Game.market.calcTransactionCost(amt, room_name, order.roomName);
    console.log('Transaction cost:', tc);
    
    // Check transaction cost against energy, and scale down amount appropriately.
    const te = Game.rooms[room_name].terminal.store[RESOURCE_ENERGY];
    
    if (te < tc) {
        console.log('Available energy too low, only:', te);
        amt = amt * te / tc - 1;
        console.log('Trying amount:', amt);
        tc = Game.market.calcTransactionCost(amt, room_name, order.roomName);
        console.log('New transaction cost:', tc);
    }
    

    let retval = Game.market.deal(order.id, amt, room_name);
    console.log('Amount:', amt, ', deal return value:', util.error_name(retval));

    return retval;
} // sell


// Transfers stuff from one terminal to another without payment.
// Returns false on error, true on success.
function transfer(src, dest, mineral, amount) {
    if (_.isString(src)) {
        src = Game.rooms[src];
    }
    if (src == null) {
        console.log('Source room not found');
        return false;
    }

    // We want dest to be a room name, not a room object
    if (!_.isString(dest)) {
        dest = dest.name;
    }

    const src_term = src.terminal;
    if (src_term == null) {
        console.log(src.name, 'has no terminal');
        return false;
    }

    const result = src_term.send(mineral, amount, dest, 'A gift from Admiral');
    console.log('Transferring', amount, mineral, 'from', src.name, 'to', dest, ':', util.error_name(result));
    return result == OK;
} // transfer


// Offer some X for sale
function offer(room, mineral, price, amount) {
    if (_.isString(room)) {
        room = Game.rooms[room];
    }
    if (room == null || room.terminal == null) {
        return false;
    }
    let retval = Game.market.createOrder(ORDER_SELL, mineral, price, amount, room.name);
    console.log('Creating order to sell', amount, mineral, 'at', price, 'from', room.name, '. Return:', util.error_name(retval));
    return retval;
}

// Clears all old orders with 0 remaining
function clear_complete() {
    const orders = _.filter(Game.market.orders, o => o.remainingAmount == 0);
    console.log('Orders to cancel:', JSON.stringify(orders));

    for (const o of orders) {
        const result = Game.market.cancelOrder(o.id);
        console.log('Cancelling order:', util.error_name(result), JSON.stringify(o));
    }
}

module.exports = {
    sell,
    offer,
    transfer,
    clear_complete,
};


/*

// from Hernanduer

var acceptTrans = false;
var reversedTransactions = Game.market.incomingTransactions.reverse();
for (var i = 0; i < reversedTransactions.length; ++i) {
    var t = reversedTransactions[i];
    if (acceptTrans == true) {
        var sendUser = "";
        if (this.v(t.sender))
            sendUser = t.sender.username;
        else
            sendUser = "NPC";
        if (!this.v(Memory.roomStats.transactionTotals))
            Memory.roomStats.transactionTotals = {};
        var tkey = sendUser + "-" + t.recipient.username;
        if (!this.v(Memory.roomStats.transactionTotals[tkey]))
            Memory.roomStats.transactionTotals[tkey] = {};
        if (!this.v(Memory.roomStats.transactionTotals[tkey][t.resourceType]))
            Memory.roomStats.transactionTotals[tkey][t.resourceType] = 0;
        Memory.roomStats.transactionTotals[tkey][t.resourceType] += t.amount;

        Memory.roomStats.lastTransaction = t.transactionId;
    }
    if (!this.v(Memory.roomStats.lastTransaction) || Memory.roomStats.lastTransaction == t.transactionId) {
        acceptTrans = true;
    }
}
acceptTrans = false;
reversedTransactions = Game.market.outgoingTransactions.reverse();
for (var i = 0; i < reversedTransactions.length; ++i) {
    var t = reversedTransactions[i];
    if (acceptTrans == true) {
        var recUser = "";
        if (this.v(t.recipient))
            recUser = t.recipient.username;
        else
            recUser = "NPC";
        if (recUser != "Hernanduer") {
            if (!this.v(Memory.roomStats.transactionTotals))
                Memory.roomStats.transactionTotals = {};
            var tkey = t.sender.username + "-" + recUser;
            if (!this.v(Memory.roomStats.transactionTotals[tkey]))
                Memory.roomStats.transactionTotals[tkey] = {};
            if (!this.v(Memory.roomStats.transactionTotals[tkey][t.resourceType]))
                Memory.roomStats.transactionTotals[tkey][t.resourceType] = 0;
            Memory.roomStats.transactionTotals[tkey][t.resourceType] += t.amount;
        }

        Memory.roomStats.lastTransactionOut = t.transactionId;
    }
    if (!this.v(Memory.roomStats.lastTransactionOut) || Memory.roomStats.lastTransactionOut == t.transactionId) {
        acceptTrans = true;
    }
}

*/
