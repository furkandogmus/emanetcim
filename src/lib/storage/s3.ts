import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import type {
  StoragePort,
  StorageCapabilities,
  PutObjectInput,
  PutObjectResult,
} from "./types";

/**
 * S3 adaptörü.
 *
 * YÜKLEME SUNUCU ÜZERİNDEN, ön-imzalı URL ile DEĞİL. Ön-imzalı PUT daha az
 * sunucu bandı harcar ama kovada CORS yapılandırması ister ve istemcinin
 * doğrudan S3'e yazmasını gerektirir — yani doğrulama istemciye kalır. Vitrin
 * fotoğrafı seyrek ve birkaç MB'lık bir iştir; baytların sunucudan geçmesi,
 * TÜRÜN SUNUCUDA doğrulanabilmesi karşılığında ucuz bir bedel.
 * (`image-validation.ts`: istemcinin `Content-Type` beyanına güvenilmiyor.)
 *
 * Ön-imzalı akış gerekirse porta yeni bir metot olarak eklenir; çağıranlar
 * değişmez.
 */

export type S3Config = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /**
   * Nesnelerin okunacağı kök adres — CloudFront alan adı ya da kovanın kendi
   * adresi. Ayrı tutuluyor çünkü CDN önü eklemek yalnızca bu değeri değiştirir.
   */
  publicBaseUrl: string;
  /** MinIO / R2 gibi S3 uyumlu servisler için. Boşsa AWS. */
  endpoint?: string;
};

export class S3Storage implements StoragePort {
  readonly capabilities: StorageCapabilities = {
    id: "s3",
    servesPublicUrls: true,
  };

  private readonly client: S3Client;

  constructor(private readonly config: S3Config) {
    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      ...(config.endpoint
        ? { endpoint: config.endpoint, forcePathStyle: true }
        : {}),
    });
  }

  publicUrl(key: string): string {
    return `${this.config.publicBaseUrl.replace(/\/+$/, "")}/${key}`;
  }

  async put(input: PutObjectInput): Promise<PutObjectResult> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        /*
          UZUN ONBELLEK: anahtar her yuklemede yeni bir UUID tasiyor, yani ayni
          anahtarin icerigi hicbir zaman degismiyor. Degisen fotograf yeni
          anahtar demek -- onbellek gecersizlestirme derdi yok.
        */
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return { key: input.key, url: this.publicUrl(input.key) };
  }

  async remove(key: string): Promise<void> {
    /*
      S3 `DeleteObject` olmayan anahtarda da BASARILI doner -- idempotent
      davranis burada bedavaya geliyor, ozel bir kontrol gerekmiyor.
    */
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
  }
}
