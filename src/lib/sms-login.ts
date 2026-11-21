/**
 * Telefona kodla giris (SMS) anahtari. SMS entegrasyonu YOK: kapali oldugu
 * surece telefon kimligiyle kod istenemez ve kodla dogrulanamaz; telefonla giris
 * yalnizca sifreyle yapilir. SMS gelirse tek yerden acilir (SMS_LOGIN_ENABLED=true).
 */
export function smsLoginEnabled(): boolean {
  return process.env.SMS_LOGIN_ENABLED === "true";
}
