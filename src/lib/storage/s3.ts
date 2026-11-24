import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isPrivateKey } from "./types";
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
  /**
   * Ikisi birlikte ya da hic. Yoksa SDK'nin varsayilan zinciri kullanilir --
   * prod'da EC2 rolu (`write-shop-media`); sunucuda uzun omurlu anahtar durmaz.
   */
  accessKeyId?: string;
  secretAccessKey?: string;
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
      ...(config.accessKeyId && config.secretAccessKey
        ? { credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } }
        : {}),
      ...(config.endpoint
        ? { endpoint: config.endpoint, forcePathStyle: true }
        : {}),
    });
  }

  publicUrl(key: string): string {
    // Ozel nesnenin adresi kova politikasi yuzunden zaten 403 verir; burada hic uretilmez.
    if (isPrivateKey(key)) throw new Error("private_object_has_no_public_url");
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

  async putPrivate(input: PutObjectInput): Promise<{ key: string }> {
    if (!isPrivateKey(input.key)) throw new Error("private_put_requires_private_prefix");
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        CacheControl: "private, no-store",
      }),
    );
    return { key: input.key };
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }));
      return true;
    } catch (err) {
      const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (e.name === "NotFound" || e.$metadata?.httpStatusCode === 404) return false;
      throw err;
    }
  }

  async presignGet(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        // Tarayici/uygulama imzali adresi onbellege almasin; adres zaten dakikalar icinde olur.
        ResponseCacheControl: "private, no-store",
      }),
      { expiresIn: expiresInSeconds },
    );
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
