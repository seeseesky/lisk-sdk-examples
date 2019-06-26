import { APIClient } from '@liskhq/lisk-client';
import {
  InvoiceTransaction,
  PaymentTransaction,
} from 'lisk-bills-transactions';
import { getAddressAndPublicKeyFromPassphrase } from '@liskhq/lisk-cryptography';
import { to } from 'await-to-js';
import * as transactions from '@liskhq/lisk-transactions';

import { dateToLiskEpochTimestamp } from './formatters';
import config from '../config.json';

const getApiClient = () => (
  new APIClient([config.serverUrl], { nethash: config.nethash })
);

export const getInvoices = ({ address }) => new Promise(async (resolve, reject) => {
  const [invoicesError, invoicesResponse] = await to(getApiClient().transactions.get({
    senderIdOrRecipientId: address,
    sort: 'timestamp:desc',
    type: InvoiceTransaction.TYPE,
  }));
  if (invoicesError) reject(invoicesError);

  const [paymentsError, paymentsResponse] = await to(getApiClient().transactions.get({
    senderIdOrRecipientId: address,
    sort: 'timestamp:desc',
    type: PaymentTransaction.TYPE,
  }));
  if (paymentsError) reject(paymentsError);

  const invoices = {
    ...invoicesResponse,
    data: invoicesResponse.data.map(invoiceTx => ({
      ...invoiceTx,
      paidStatus: paymentsResponse.data.find(paymentTx => paymentTx.asset.data === invoiceTx.id),
    })),
  };

  resolve(invoices);
});

export const getAccount = ({ passphrase }) => new Promise((resolve, reject) => {
  const { publicKey, address } = getAddressAndPublicKeyFromPassphrase(passphrase);
  getApiClient().accounts.get({ address }).then((response) => {
    if (response.data.length > 0) {
      resolve({
        ...response.data[0],
        publicKey,
        passphrase,
      });
    } else {
      // when the account has no transactions yet (therefore is not saved on the blockchain)
      // this endpoint returns { success: false }
      resolve({
        passphrase,
        address,
        publicKey,
        balance: 0,
      });
    }
  }).catch(reject);
});

export const sendInvoice = ({
  client, requestedAmount, description,
}, passphrase) => {
  const invoiceTx = new InvoiceTransaction({
    type: InvoiceTransaction.TYPE,
    asset: {
      client,
      requestedAmount: transactions.utils.convertLSKToBeddows(requestedAmount),
      description,
    },
    fee: transactions.utils.convertLSKToBeddows('1'),
    senderPublicKey: getAddressAndPublicKeyFromPassphrase(passphrase).publicKey,
    recipientId: client,
    timestamp: dateToLiskEpochTimestamp(new Date()),
  });

  invoiceTx.sign(passphrase);
  return getApiClient().transactions.broadcast(invoiceTx.toJSON());
};

export const sendPayment = ({
  recipientId, amount, invoiceID,
}, passphrase) => {
  const paymentTx = new PaymentTransaction({
    type: PaymentTransaction.TYPE,
    asset: {
      data: invoiceID,
    },
    fee: transactions.utils.convertLSKToBeddows('0.1'),
    amount: transactions.utils.convertLSKToBeddows(amount),
    recipientId,
    senderPublicKey: getAddressAndPublicKeyFromPassphrase(passphrase).publicKey,
    timestamp: dateToLiskEpochTimestamp(new Date()),
  });

  paymentTx.sign(passphrase);
  return getApiClient().transactions.broadcast(paymentTx.toJSON());
};
