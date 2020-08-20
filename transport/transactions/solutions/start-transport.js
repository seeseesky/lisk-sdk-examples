/*
 * Copyright © 2020 Lisk Foundation
 *
 * See the LICENSE file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with the Lisk Foundation,
 * no part of this software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE file.
 *
 * Removal or modification of this copyright notice is prohibited.
 */
const {
    BaseTransaction,
    TransactionError,
    utils
} = require('@liskhq/lisk-transactions');
const { intToBuffer, stringToBuffer } = require('@liskhq/lisk-cryptography');


class StartTransportTransaction extends BaseTransaction {

    static get TYPE () {
        return 21;
    }

    async prepare(store) {
        await store.account.cache([
            {
                address: this.asset.packetId,
            },
            {
                address: this.senderId,
            }
        ]);
    }

    validateAsset() {
        const errors = [];

        return errors;
    }

    async applyAsset(store) {
        const errors = [];
        const packet = await store.account.get(this.asset.packetId);
        if (packet.asset.status === "pending"){
            const carrier = await store.account.get(this.senderId);
            console.log("carrier1");
            console.log(carrier);
            console.log("packet1");
            console.log(packet);
            const carrierTrust = carrier.asset.trust ? carrier.asset.trust : '0';
            const carrierBalance = carrier.balance;
            const packetSecurity = BigInt(packet.asset.security);
            // If the carrier has the trust to transport the packet
            if (BigInt(packet.asset.minTrust) <= BigInt(carrierTrust) && (carrierBalance >= packetSecurity)) {
                /**
                 * Update the Carrier account:
                 * - Lock security inside the account
                 * - Remove the security form balance
                 * - initialize carriertrust, if not present already
                 */
                const carrierBalanceWithoutSecurity = carrierBalance - packetSecurity;
                carrier.balance = carrierBalanceWithoutSecurity;
                carrier.asset = {
                    trust: carrierTrust,
                    lockedSecurity: packet.asset.security
                };
                //carrier.asset.trust = carrierTrust;
                //carrier.asset.lockedSecurity = packet.asset.security;
                console.log("carrier2");
                console.log(carrier);

                store.account.set(carrier.address, carrier);
                /**
                 * Update the Packet account:
                 * - Set status to "ongoing"
                 * - set carrier to ID of the carrier
                 */
                //packet.asset.status = "ongoing";
                //packet.asset.carrier = carrier.address;
                packet.asset = {
                    ...packet.asset,
                    status: "ongoing",
                    carrier: carrier.address
                };
                console.log("packet2");
                console.log(packet);
                store.account.set(packet.address, packet);
            } else {
                errors.push(
                    new TransactionError(
                        'carrier has not enough trust to deliver the packet, or not enough balance to pay the security',
                        packet.asset.minTrust,
                        carrier.asset.trust,
                        packet.asset.security,
                        carrier.balance.toString()
                    )
                );
            }
        } else {
            errors.push(
                new TransactionError(
                    'packet status needs to be "pending"',
                    packet.asset.status
                )
            );
        }

        return errors;
    }

    async undoAsset(store) {
        const errors = [];
        const packet = await store.account.get(this.asset.recipientId);
        const carrier = await store.account.get(this.senderId);
        /* --- Revert carrier account --- */
        const carrierBalanceWithSecurity = BigInt(carrier.balance) + BigInt(packet.assset.security);
        carrier.balance = carrierBalanceWithSecurity.toString();
        store.account.set(carrier.address, carrier);
        /* --- Revert packet account --- */
        packet.asset.deliveryStatus = "pending";
        packet.asset.carrier = null;
        store.account.set(packet.address, packet);
        return errors;
    }

}

module.exports = StartTransportTransaction;
