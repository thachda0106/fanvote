import { Kafka, type Producer } from 'kafkajs';
import { logger } from '../common/logger';

/** Kafka producer for the vote context — topic `eventista.vote.cast` (AsyncAPI). */
export class KafkaService {
  private producer?: Producer;
  private connected = false;

  private get brokers(): string[] {
    return (process.env.KAFKA_BROKERS ?? 'localhost:19095').split(',');
  }

  async connect(): Promise<void> {
    const kafka = new Kafka({
      clientId: 'voting',
      brokers: this.brokers,
      retry: { initialRetryTime: 300, retries: 8 },
    });
    this.producer = kafka.producer({ allowAutoTopicCreation: true });
    await this.producer.connect();
    this.connected = true;
    logger.info({ brokers: this.brokers }, 'kafka.producer.connected');
  }

  async publish(topic: string, key: string, value: string, headers: Record<string, string>): Promise<void> {
    if (!this.producer || !this.connected) {
      throw new Error('kafka producer not connected');
    }
    await this.producer.send({ topic, messages: [{ key, value, headers }] });
  }

  async disconnect(): Promise<void> {
    if (this.producer && this.connected) {
      await this.producer.disconnect();
      this.connected = false;
    }
  }
}