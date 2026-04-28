import { connect, Channel } from 'amqplib';

// Define Connection type based on return type of connect
type AmqpConnection = Awaited<ReturnType<typeof connect>>;

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';

interface RabbitMQGlobal {
  connection: AmqpConnection | null;
  channel: Channel | null;
  promise: Promise<AmqpConnection> | null;
}

const globalForRabbit = global as unknown as { rabbitmq: RabbitMQGlobal };

// Initialize global object if not exists
if (!globalForRabbit.rabbitmq) {
  globalForRabbit.rabbitmq = {
    connection: null,
    channel: null,
    promise: null,
  };
}

async function connectWithRetry(retries = 5, delay = 1000): Promise<AmqpConnection> {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Attempting to connect to RabbitMQ (Attempt ${i + 1}/${retries})...`);
      // Add heartbeat to URL if not present
      let url = RABBITMQ_URL;
      if (!url.includes('heartbeat=')) {
        url += (url.includes('?') ? '&' : '?') + 'heartbeat=60';
      }

      const conn = await connect(url);

      conn.on('error', (err: any) => {
        console.error('RabbitMQ connection error:', err);
        globalForRabbit.rabbitmq.connection = null;
        globalForRabbit.rabbitmq.channel = null;
        globalForRabbit.rabbitmq.promise = null;
      });

      conn.on('close', () => {
        console.warn('RabbitMQ connection closed');
        globalForRabbit.rabbitmq.connection = null;
        globalForRabbit.rabbitmq.channel = null;
        globalForRabbit.rabbitmq.promise = null;
      });

      console.log('Connected to RabbitMQ');
      return conn;
    } catch (error) {
      console.error(`Failed to connect to RabbitMQ (Attempt ${i + 1}/${retries}):`, error);
      if (i < retries - 1) {
        await new Promise(res => setTimeout(res, delay));
        delay *= 2; // Exponential backoff
      }
    }
  }
  throw new Error('Failed to connect to RabbitMQ after multiple retries');
}

export async function getRabbitMQConnection(): Promise<AmqpConnection> {
  if (globalForRabbit.rabbitmq.connection) {
    return globalForRabbit.rabbitmq.connection;
  }

  // Prevent multiple simultaneous connection attempts
  if (!globalForRabbit.rabbitmq.promise) {
    globalForRabbit.rabbitmq.promise = connectWithRetry();
  }

  try {
    const conn = await globalForRabbit.rabbitmq.promise;
    globalForRabbit.rabbitmq.connection = conn;
    return conn;
  } catch (error) {
    globalForRabbit.rabbitmq.promise = null;
    throw error;
  }
}

export async function getRabbitMQChannel(): Promise<Channel> {
  if (globalForRabbit.rabbitmq.channel) {
    return globalForRabbit.rabbitmq.channel;
  }

  try {
    const conn = await getRabbitMQConnection();
    const ch = await conn.createChannel();

    ch.on('error', (err: any) => {
      console.error('RabbitMQ channel error:', err);
      globalForRabbit.rabbitmq.channel = null;
    });

    ch.on('close', () => {
      console.warn('RabbitMQ channel closed');
      globalForRabbit.rabbitmq.channel = null;
    });

    // Set prefetch to 1 to ensure fair distribution and prevent overwhelming
    await ch.prefetch(1);

    globalForRabbit.rabbitmq.channel = ch;
    console.log('Created RabbitMQ channel');
    return ch;
  } catch (error) {
    console.error('Failed to create RabbitMQ channel:', error);
    throw error;
  }
}

export async function closeRabbitMQ() {
  try {
    if (globalForRabbit.rabbitmq.channel) {
      await globalForRabbit.rabbitmq.channel.close();
      globalForRabbit.rabbitmq.channel = null;
    }
    if (globalForRabbit.rabbitmq.connection) {
      await globalForRabbit.rabbitmq.connection.close();
      globalForRabbit.rabbitmq.connection = null;
    }
    globalForRabbit.rabbitmq.promise = null;
    console.log('RabbitMQ connection closed gracefully');
  } catch (error) {
    console.error('Error closing RabbitMQ connection:', error);
  }
}
