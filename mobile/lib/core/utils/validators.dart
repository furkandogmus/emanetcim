/// Kimlik dogrulama formlari (giris/kayit) arasinda paylasilan girdi
/// dogrulayicilari.
///
/// Onceden login_screen.dart ve register_screen.dart'ta birebir kopyalanmis
/// bir regex vardi (`[\w-\.]+@([\w-]+\.)+[\w-]{2,4}`): `\w` '+' isaretini
/// kapsamaz ve TLD grubu 4 karakterle sinirliydi. Bu yuzden Gmail '+'
/// etiketleme kullanan (`kullanici+test@gmail.com`) ya da 4 karakterden uzun
/// bir TLD'ye sahip (`ad@sirket.technology`) gecerli adresler istemci
/// tarafinda reddediliyordu ve istek sunucuya hic gitmiyordu. Regex burada
/// tek yerden gevsetildi; iki ekran de bu fonksiyonu cagirir.
bool isValidEmail(String email) {
  return RegExp(r'^[\w.+-]+@[\w-]+(\.[\w-]+)+$').hasMatch(email);
}
