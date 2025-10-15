const amqp = require('amqplib');

let connection;
let channel;

async function connect() {
  connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
  connection.on('close', () => {
    console.error('RabbitMQ connection closed');
    channel = null;
  });
  connection.on('error', err => {
    console.error('RabbitMQ connection error', err);
    channel = null;
  });

  channel = await connection.createChannel();
  return channel;
}

async function getChannel() {
  if (channel) return channel;
  return connect();
}

module.exports = getChannel;

