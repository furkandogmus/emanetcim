/**
 * Admin aramasinda yazilan telefonu, saklanan bicimlerle (10 hane `5xxxxxxxxx` ya
 * da eski E.164 `+90...`) eslesecek haneye indirir. "0532 123 45 67", "+90 (532) ..."
 * ve tirelli yazimlarin hepsi ayni sonuca gelir. Cok kisa dizi `null`: kisa bir
 * kod rastgele telefonlarla eslesmesin.
 */
export function phoneSearchDigits(term: string, minDigits = 7): string | null {
  let d = term.replace(/\D/g, "");
  if (d.startsWith("90") && d.length >= 11) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  if (d.length > 10) d = d.slice(-10);
  return d.length >= minDigits ? d : null;
}
