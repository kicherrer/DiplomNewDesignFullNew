interface YouTubeAPIConfig {
  keys: string[];
  quotaLimitPerKey: number;
  quotaResetIntervalHours: number;
}

interface KeyUsage {
  key: string;
  quotaUsed: number;
  lastReset: Date;
  isExhausted: boolean;
}

export class YouTubeAPIKeyManager {
  private readonly config: YouTubeAPIConfig;
  private keyUsage: KeyUsage[];
  private currentKeyIndex: number;

  constructor(config: YouTubeAPIConfig) {
    this.config = config;
    this.currentKeyIndex = 0;
    this.keyUsage = config.keys.map(key => ({
      key,
      quotaUsed: 0,
      lastReset: new Date(),
      isExhausted: false
    }));
  }

  public getCurrentKey(): string {
    return this.keyUsage[this.currentKeyIndex].key;
  }

  public async getAvailableKey(): Promise<string> {
    const now = new Date();
    const startIndex = this.currentKeyIndex;
    let checkedKeys = 0;
    const totalKeys = this.keyUsage.length;

    do {
      const usage = this.keyUsage[this.currentKeyIndex];
      
      // Проверяем, нужно ли сбросить квоту
      const hoursSinceReset = (now.getTime() - usage.lastReset.getTime()) / (1000 * 60 * 60);
      if (hoursSinceReset >= this.config.quotaResetIntervalHours) {
        usage.quotaUsed = 0;
        usage.lastReset = now;
        usage.isExhausted = false;
      }

      // Если ключ не исчерпан и доступен, возвращаем его
      if (!usage.isExhausted && usage.quotaUsed < this.config.quotaLimitPerKey) {
        return usage.key;
      }

      // Переходим к следующему ключу
      this.currentKeyIndex = (this.currentKeyIndex + 1) % totalKeys;
      checkedKeys++;

      // Проверяем, не вернулись ли мы к начальному индексу
      if (this.currentKeyIndex === startIndex) {
        break;
      }
    } while (checkedKeys < totalKeys);
    
    // Если все ключи исчерпаны, сбрасываем их состояние и пробуем снова через час
    throw new Error('Все API ключи YouTube исчерпали свою квоту. Попробуйте снова через час.');

  }

  public incrementQuotaUsage(cost: number = 1): void {
    const usage = this.keyUsage[this.currentKeyIndex];
    usage.quotaUsed += cost;
    
    // Проверяем, не превышена ли квота
    if (usage.quotaUsed >= this.config.quotaLimitPerKey) {
      this.markKeyAsExhausted();
    }
  }

  public markKeyAsExhausted(): void {
    const usage = this.keyUsage[this.currentKeyIndex];
    usage.quotaUsed = this.config.quotaLimitPerKey;
    usage.isExhausted = true;
    
    // Сохраняем текущее время как время последнего сброса
    usage.lastReset = new Date();
    
    // Автоматически переключаемся на следующий ключ
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keyUsage.length;
  }

  public getQuotaStatus(): { available: number; total: number } {
    const totalQuota = this.config.quotaLimitPerKey * this.config.keys.length;
    const usedQuota = this.keyUsage.reduce((sum, usage) => sum + usage.quotaUsed, 0);
    return {
      available: totalQuota - usedQuota,
      total: totalQuota
    };
  }
}