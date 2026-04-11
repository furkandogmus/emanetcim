#!/usr/bin/env python3
"""Plandaki Phase 2.4: de, fr, es, it, pl için FAQ + ödeme/Phase1 Guest + Footer."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCALES = ROOT / "src" / "locales"

# --- Almanca ---
DE_FAQ = {
    "q1": "Ist mein Gepäck sicher?",
    "a1": "Ja. Partner-Shops folgen den Plattformregeln; Gepäck wird bei der Abgabe versiegelt und fotografiert. Schutz bis zu 5.000 TL pro Stück gilt unter den Bedingungen in unseren AGB — er ergänzt den Shop-Betrieb und ist keine eigenständige Einzelhandels-Police.",
    "q2": "Wie funktionieren Rückerstattungen bei Stornierung?",
    "a2": "Stornieren Sie mindestens 24 Stunden vor Check-in, erhalten Sie eine volle Rückerstattung auf Ihre Karte. Zwischen 1 und 24 Stunden vor Check-in werden 50% auf die Karte erstattet. Weniger als 1 Stunde vor Check-in oder nach Check-in-Zeit gibt es keine Kartenerstattung — Sie erhalten einen einmaligen Rabattcode über den gezahlten Betrag. Ohne abgeschlossene Zahlung können Sie die Anfrage jederzeit kostenlos stornieren.",
    "q3": "Welche Zahlungsmethoden werden akzeptiert?",
    "a3": "Online-Zahlung mit gängigen Karten über unseren sicheren Anbieter (iyzico). Barzahlung ist nicht möglich. Apple Pay, Google Pay und PayPal können wir über Stripe aktivieren — wir informieren auf der Website.",
    "q4": "Was tun, wenn der Shop geschlossen ist oder ich Hilfe brauche?",
    "a4": "Kontaktieren Sie uns über die Kontaktseite oder WhatsApp. Wir helfen bei Umbuchung, einer anderen nahegelegenen Aufbewahrung oder Problemen mit Ihrer Buchung.",
    "q5": "Was deckt die Versicherungszeile im Checkout ab?",
    "a5": "Die Versicherungsgebühr im Checkout trägt zum Schutzpaket bei, das in unseren AGB beschrieben ist (bis zu 5.000 TL pro Stück bei Erfüllung der Voraussetzungen). Umfang, Ausschlüsse und Schritte stehen in den AGB — bitte vor der Buchung lesen.",
    "q6": "Wie läuft die Buchung ab?",
    "a6": "Sie senden eine Anfrage mit Datum und Gepäckgrößen. Der Shop prüft und genehmigt. Anschließend schließen Sie ggf. die Zahlung ab und erhalten einen QR-Code für die Abgabe. Es handelt sich um einen Anfrageprozess — sofortige Bestätigung kann je nach Shop variieren.",
    "q7": "Gibt es Gepäckgrößen?",
    "a7": "Ja. Wir nutzen S-, M- und XL-Slots mit unterschiedlichen Tagespreisen. Wählen Sie die passende Größe. Sehr große oder ungewöhnliche Gegenstände können eine Shop-Freigabe erfordern — fragen Sie vor der Buchung den Support.",
    "q8": "Akzeptieren Sie Bargeld?",
    "a8": "Nein. Nur Online-Kartenzahlung (und künftig Wallet-Optionen). So bleibt eine klare Zahlungsspur und es passt zu den Plattform-Schutzregeln.",
}

DE_GUEST = {
    "trustInsuranceBody": "Bis zu 5.000 TL pro Stück laut AGB bei erfüllten Voraussetzungen; Versiegelung und Foto bei Abgabe. Keine eigenständige Einzelhandels-Police.",
    "bagProtectionBody": "Im Checkout sehen Sie eine Schutzgebühr gemäß AGB (bis 5.000 TL pro Stück). Bitte AGB und FAQ vor der Buchung lesen.",
    "cityHubViewAll": "Alle Städte & Guides",
    "checkoutPolicyCalloutTitle": "Stornierung kurz",
    "checkoutPolicyCalloutBody": "24+ h vor Check-in: volle Kartenerstattung. 1–24 h vorher: 50% Kartenerstattung. Unter 1 h oder nach Check-in: einmaliger Rabattcode statt Kartenerstattung. Unbezahlte Anfrage: jederzeit stornierbar. Details in den FAQ.",
    "checkoutPaymentMethodsNote": "Kartenzahlung über iyzico (sicher). Kein Bargeld. Apple Pay / Google Pay / PayPal mit Stripe — wir kündigen es an.",
    "checkoutFaqLink": "FAQ",
    "shopDetailInsuranceHint": "Schutz bis 5.000 TL pro Stück laut AGB — siehe FAQ.",
    "payBookingTitle": "Zahlung abschließen",
    "payBookingSubtitle": "Sicher mit Karte zahlen. Apple Pay, Google Pay oder Link erscheinen, wenn sie in Ihrem Stripe-Dashboard aktiviert sind.",
    "payBookingSubmit": "Jetzt zahlen",
    "payBookingProcessing": "Wird verarbeitet…",
    "payBookingFailed": "Zahlung fehlgeschlagen. Bitte erneut versuchen.",
    "payBookingFinalizeFailed": "Zahlung eingegangen; die Bestätigung kann einen Moment dauern. Seite gleich aktualisieren.",
    "payBookingBack": "Zurück zur Buchung",
    "payBookingOpenCta": "Jetzt bezahlen",
    "bookingDetailWaitingTitle": "Warten auf Shop-Freigabe",
    "bookingDetailPaymentNeededTitle": "Zahlung erforderlich",
    "bookingDetailPaymentNeededSub": "Der Shop hat Ihre Anfrage genehmigt. Schließen Sie die Zahlung ab, um die Buchung zu bestätigen.",
    "bookingDetailPaymentNoStripeNote": "Stripe-Checkout ist in dieser Umgebung nicht aktiv. Kontaktieren Sie den Support oder zahlen Sie nach Anweisung des Shops.",
    "bookingDetailQrAfterPayment": "Ihr Abgabe-QR-Code erscheint hier nach erfolgter Zahlung.",
    "payBookingError_payments_disabled": "Zahlungen sind auf der Plattform derzeit deaktiviert.",
    "payBookingError_gateway_not_stripe": "Stripe-Checkout ist nicht aktiv (PAYMENT_GATEWAY=stripe und Schlüssel erforderlich).",
    "payBookingError_stripe_not_configured": "Stripe ist nicht konfiguriert (STRIPE_SECRET_KEY oder Publishable Key fehlt).",
    "payBookingError_booking_not_found": "Buchung nicht gefunden oder kein Zugriff.",
    "payBookingError_invalid_booking_status": "Für diese Buchung ist keine Zahlung fällig.",
    "payBookingError_already_paid": "Diese Buchung ist bereits bezahlt.",
    "payBookingError_invalid_amount": "Ungültiger Betrag.",
    "payBookingError_stripe_no_client_secret": "Checkout konnte nicht gestartet werden (Stripe).",
    "payBookingError_stripe_error": "Stripe-Fehler. Bitte später erneut versuchen.",
    "payBookingErrorUnknown": "Etwas ist schiefgelaufen. Bitte erneut versuchen oder den Support kontaktieren.",
    "payBookingReturnSyncing": "Zahlung wird bestätigt…",
    "payBookingReturnFailed": "Die Zahlung konnte nicht bestätigt werden. Prüfen Sie den Buchungsstatus oder versuchen Sie es erneut.",
}

DE_FOOTER = {
    "citiesViewAll": "Alle Städte & Guides",
    "paymentsNote": "Karten über iyzico (sicher). Kein Bargeld. Wallets (Apple/Google Pay, PayPal) mit Stripe geplant.",
}

# --- Französisch ---
FR_FAQ = {
    "q1": "Mes bagages sont-ils en sécurité ?",
    "a1": "Oui. Les commerces partenaires respectent les règles de la plateforme ; les sacs sont scellés et photographiés au dépôt. Une protection jusqu’à 5 000 TL par pièce s’applique selon nos conditions générales — ce n’est pas une police d’assurance grand public autonome.",
    "q2": "Comment fonctionnent les remboursements si j’annule ?",
    "a2": "Si vous annulez au moins 24 h avant l’enregistrement, remboursement intégral sur la carte. Entre 1 et 24 h avant : 50 % remboursés sur la carte. Moins d’1 h avant ou après l’heure d’enregistrement : pas de remboursement carte — vous recevez un code de réduction unique pour le montant payé. Sans paiement finalisé, vous pouvez annuler la demande gratuitement à tout moment.",
    "q3": "Quels moyens de paiement sont acceptés ?",
    "a3": "Paiement en ligne par carte via notre prestataire sécurisé (iyzico). Pas d’espèces. Apple Pay, Google Pay et PayPal pourront être activés via Stripe — nous l’annoncerons sur le site.",
    "q4": "Et si le commerce est fermé ou j’ai besoin d’aide ?",
    "a4": "Contactez-nous via la page contact ou WhatsApp. Nous vous aidons à reporter, trouver un autre point proche ou résoudre un problème de réservation.",
    "q5": "Que couvre la ligne « assurance » au paiement ?",
    "a5": "Les frais indiqués contribuent à la protection décrite dans nos CGV (jusqu’à 5 000 TL par pièce si conditions remplies). Périmètre, exclusions et réclamations figurent dans les CGV — lisez-les avant de réserver.",
    "q6": "Comment fonctionne la réservation ?",
    "a6": "Vous envoyez une demande avec dates et tailles de bagages. Le commerce valide. Vous finalisez le paiement si nécessaire et recevez un QR code pour le dépôt. Flux sur demande — confirmation immédiate variable selon le commerce.",
    "q7": "Y a-t-il des tailles de bagages ?",
    "a7": "Oui. Formats S, M et XL avec tarifs journaliers différents. Les objets très volumineux peuvent nécessiter une validation — contactez le support avant réservation.",
    "q8": "Acceptez-vous les espèces ?",
    "a8": "Non. Paiement carte en ligne uniquement (et portefeuilles numériques à venir), pour une traçabilité claire et les règles de protection de la plateforme.",
}

FR_GUEST = {k: v for k, v in DE_GUEST.items()}  # copy keys, replace with FR below
# Manual FR overrides (DE_GUEST keys same structure)
FR_GUEST.update(
    {
        "trustInsuranceBody": "Jusqu’à 5 000 TL par pièce selon les CGV si conditions remplies ; scellage et photo au dépôt. Pas une police grand public autonome.",
        "bagProtectionBody": "Les frais au paiement contribuent à la couverture définie dans les CGV (jusqu’à 5 000 TL par pièce). Lisez CGV et FAQ avant réservation.",
        "cityHubViewAll": "Toutes les villes & guides",
        "checkoutPolicyCalloutTitle": "Annulation (résumé)",
        "checkoutPolicyCalloutBody": "24 h+ avant enregistrement : remboursement carte intégral. 1–24 h avant : 50 % sur la carte. Moins d’1 h ou après : code promo unique au lieu du remboursement. Demande non payée : annulation libre. Détails dans la FAQ.",
        "checkoutPaymentMethodsNote": "Paiement carte via iyzico (sécurisé). Pas d’espèces. Apple Pay / Google Pay / PayPal avec Stripe — annonce à venir.",
        "shopDetailInsuranceHint": "Couverture jusqu’à 5 000 TL par pièce selon CGV — voir FAQ.",
        "payBookingTitle": "Finaliser le paiement",
        "payBookingSubtitle": "Payez en toute sécurité par carte. Apple Pay, Google Pay ou Link peuvent apparaître s’ils sont activés dans Stripe.",
        "payBookingSubmit": "Payer",
        "payBookingProcessing": "Traitement…",
        "payBookingFailed": "Paiement échoué. Réessayez.",
        "payBookingFinalizeFailed": "Paiement reçu ; la confirmation peut prendre un instant. Actualisez la page.",
        "payBookingBack": "Retour à la réservation",
        "payBookingOpenCta": "Payer maintenant",
        "bookingDetailWaitingTitle": "En attente d’approbation du commerce",
        "bookingDetailPaymentNeededTitle": "Paiement requis",
        "bookingDetailPaymentNeededSub": "Le commerce a approuvé votre demande. Finalisez le paiement pour confirmer.",
        "bookingDetailPaymentNoStripeNote": "Le paiement Stripe n’est pas activé dans cet environnement. Contactez le support ou suivez les instructions du commerce.",
        "bookingDetailQrAfterPayment": "Votre QR code de dépôt apparaît ici après paiement.",
        "payBookingError_payments_disabled": "Les paiements sont désactivés sur la plateforme.",
        "payBookingError_gateway_not_stripe": "Stripe n’est pas activé (PAYMENT_GATEWAY=stripe et clés requises).",
        "payBookingError_stripe_not_configured": "Stripe n’est pas configuré (clé secrète ou clé publique manquante).",
        "payBookingError_booking_not_found": "Réservation introuvable ou accès refusé.",
        "payBookingError_invalid_booking_status": "Aucun paiement attendu pour cette réservation.",
        "payBookingError_already_paid": "Cette réservation est déjà payée.",
        "payBookingError_invalid_amount": "Montant invalide.",
        "payBookingError_stripe_no_client_secret": "Impossible de démarrer le paiement (Stripe).",
        "payBookingError_stripe_error": "Erreur Stripe. Réessayez plus tard.",
        "payBookingErrorUnknown": "Une erreur s’est produite. Réessayez ou contactez le support.",
        "payBookingReturnSyncing": "Confirmation du paiement…",
        "payBookingReturnFailed": "Le paiement n’a pas pu être confirmé. Vérifiez le statut ou réessayez.",
    }
)

# --- Espagnol ---
ES_FAQ = {
    "q1": "¿Está seguro mi equipaje?",
    "a1": "Sí. Los comercios asociados cumplen las reglas de la plataforma; las maletas se sellan y fotografían al dejarlas. La protección de hasta 5.000 TL por pieza aplica según nuestros Términos — no es una póliza minorista independiente.",
    "q2": "¿Cómo funcionan los reembolsos si cancelo?",
    "a2": "Si cancelas al menos 24 h antes del check-in, reembolso completo a tu tarjeta. Entre 1 y 24 h antes: 50% a la tarjeta. Menos de 1 h antes o después del check-in: sin reembolso a tarjeta — recibes un código de descuento único por el importe pagado. Sin pago completado, puedes cancelar la solicitud gratis en cualquier momento.",
    "q3": "¿Qué métodos de pago aceptáis?",
    "a3": "Pago online con tarjetas a través de nuestro proveedor seguro (iyzico). No se acepta efectivo. Apple Pay, Google Pay y PayPal se pueden activar con Stripe — lo anunciaremos en la web.",
    "q4": "¿Y si la tienda está cerrada o necesito ayuda?",
    "a4": "Contáctanos por la página de contacto o WhatsApp. Te ayudamos a reprogramar, encontrar otro punto cercano o resolver problemas con tu reserva.",
    "q5": "¿Qué cubre la línea de seguro en el checkout?",
    "a5": "La tasa en el checkout contribuye a la protección descrita en nuestros Términos (hasta 5.000 TL por pieza si se cumplen condiciones). Alcance y exclusiones en los Términos — léelos antes de reservar.",
    "q6": "¿Cómo funciona la reserva?",
    "a6": "Envías una solicitud con fechas y tallas de maletas. La tienda revisa y aprueba. Luego completas el pago si aplica y recibes un código QR para el depósito. Es un flujo por solicitud — la confirmación instantánea puede variar.",
    "q7": "¿Hay tallas de equipaje?",
    "a7": "Sí. Usamos tallas S, M y XL con precios diarios distintos. Objetos muy grandes pueden requerir aprobación — consulta al soporte antes.",
    "q8": "¿Aceptáis efectivo?",
    "a8": "No. Solo pago con tarjeta online (y wallets en el futuro), para trazabilidad y las reglas de protección de la plataforma.",
}

ES_GUEST = {
    "trustInsuranceBody": "Hasta 5.000 TL por pieza según Términos si se cumplen condiciones; sello y foto al depósito. No es póliza minorista independiente.",
    "bagProtectionBody": "En el checkout verás una tasa de protección según Términos (hasta 5.000 TL por pieza). Lee Términos y FAQ antes de reservar.",
    "cityHubViewAll": "Todas las ciudades y guías",
    "checkoutPolicyCalloutTitle": "Cancelación (resumen)",
    "checkoutPolicyCalloutBody": "24+ h antes del check-in: reembolso completo a tarjeta. 1–24 h: 50% a tarjeta. Menos de 1 h o después: código de descuento en lugar de reembolso. Solicitud sin pago: cancela cuando quieras. Más en FAQ.",
    "checkoutPaymentMethodsNote": "Pago con tarjeta vía iyzico (seguro). Sin efectivo. Apple Pay / Google Pay / PayPal con Stripe — lo anunciaremos.",
    "checkoutFaqLink": "FAQ",
    "shopDetailInsuranceHint": "Cobertura hasta 5.000 TL por pieza según Términos — ver FAQ.",
    "payBookingTitle": "Completar pago",
    "payBookingSubtitle": "Paga con tarjeta de forma segura. Apple Pay, Google Pay o Link pueden aparecer si están activos en Stripe.",
    "payBookingSubmit": "Pagar ahora",
    "payBookingProcessing": "Procesando…",
    "payBookingFailed": "Pago fallido. Inténtalo de nuevo.",
    "payBookingFinalizeFailed": "Pago recibido; la confirmación puede tardar un momento. Actualiza la página.",
    "payBookingBack": "Volver a la reserva",
    "payBookingOpenCta": "Pagar",
    "bookingDetailWaitingTitle": "Esperando aprobación de la tienda",
    "bookingDetailPaymentNeededTitle": "Pago requerido",
    "bookingDetailPaymentNeededSub": "La tienda aprobó tu solicitud. Completa el pago para confirmar la reserva.",
    "bookingDetailPaymentNoStripeNote": "Stripe no está activo en este entorno. Contacta soporte o paga según indique la tienda.",
    "bookingDetailQrAfterPayment": "Tu código QR para el depósito aparece aquí tras el pago.",
    "payBookingError_payments_disabled": "Los pagos están desactivados en la plataforma.",
    "payBookingError_gateway_not_stripe": "Stripe no está activo (PAYMENT_GATEWAY=stripe y claves necesarias).",
    "payBookingError_stripe_not_configured": "Stripe no está configurado (falta clave secreta o publicable).",
    "payBookingError_booking_not_found": "Reserva no encontrada o sin acceso.",
    "payBookingError_invalid_booking_status": "Esta reserva no espera pago.",
    "payBookingError_already_paid": "Esta reserva ya está pagada.",
    "payBookingError_invalid_amount": "Importe no válido.",
    "payBookingError_stripe_no_client_secret": "No se pudo iniciar el pago (Stripe).",
    "payBookingError_stripe_error": "Error de Stripe. Inténtalo más tarde.",
    "payBookingErrorUnknown": "Algo salió mal. Inténtalo de nuevo o contacta soporte.",
    "payBookingReturnSyncing": "Confirmando el pago…",
    "payBookingReturnFailed": "No se pudo confirmar el pago. Revisa el estado o inténtalo de nuevo.",
}

ES_FOOTER = {
    "citiesViewAll": "Todas las ciudades y guías",
    "paymentsNote": "Tarjetas vía iyzico (seguro). Sin efectivo. Wallets (Apple/Google Pay, PayPal) previstos con Stripe.",
}

# --- Italiano ---
IT_FAQ = {
    "q1": "Il mio bagaglio è al sicuro?",
    "a1": "Sì. I negozi partner seguono le regole della piattaforma; i bagagli vengono sigillati e fotografati al deposito. Protezione fino a 5.000 TL per pezzo secondo i Termini — non è una polizza retail autonoma.",
    "q2": "Come funzionano i rimborsi in caso di cancellazione?",
    "a2": "Cancellando almeno 24 ore prima del check-in, rimborso integrale sulla carta. Tra 1 e 24 ore prima: 50% sulla carta. Meno di 1 ora prima o dopo il check-in: nessun rimborso sulla carta — ricevi un codice sconto una tantum per l’importo pagato. Senza pagamento completato puoi annullare la richiesta gratuitamente in qualsiasi momento.",
    "q3": "Quali metodi di pagamento accettate?",
    "a3": "Pagamento online con carte tramite il nostro fornitore sicuro (iyzico). Nessun contante. Apple Pay, Google Pay e PayPal possono essere abilitati con Stripe — lo comunicheremo sul sito.",
    "q4": "E se il negozio è chiuso o ho bisogno di aiuto?",
    "a4": "Contattaci dalla pagina contatti o WhatsApp. Ti aiutiamo a riprogrammare, trovare un altro punto vicino o risolvere problemi con la prenotazione.",
    "q5": "Cosa copre la voce assicurativa al checkout?",
    "a5": "Il contributo al checkout fa parte del pacchetto di protezione descritto nei Termini (fino a 5.000 TL per pezzo se si rispettano le condizioni). Dettagli ed esclusioni nei Termini — leggili prima di prenotare.",
    "q6": "Come funziona la prenotazione?",
    "a6": "Invii una richiesta con date e dimensioni dei bagagli. Il negozio approva. Poi completi il pagamento se necessario e ricevi un QR code per il deposito. Flusso su richiesta — conferma immediata variabile per negozio.",
    "q7": "Ci sono taglie per i bagagli?",
    "a7": "Sì. Slot S, M e XL con tariffe giornaliere diverse. Oggetti molto ingombranti possono richiedere approvazione — chiedi al supporto prima.",
    "q8": "Accettate contanti?",
    "a8": "No. Solo pagamento con carta online (e wallet in futuro), per tracciabilità e regole di protezione della piattaforma.",
}

IT_GUEST = {
    "trustInsuranceBody": "Fino a 5.000 TL per pezzo secondo i Termini se le condizioni sono soddisfatte; sigillo e foto al deposito. Non una polizza retail autonoma.",
    "bagProtectionBody": "Al checkout vedi un contributo per la protezione definita nei Termini (fino a 5.000 TL per pezzo). Leggi Termini e FAQ prima di prenotare.",
    "cityHubViewAll": "Tutte le città e le guide",
    "checkoutPolicyCalloutTitle": "Cancellazione (sintesi)",
    "checkoutPolicyCalloutBody": "24+ h prima del check-in: rimborso integrale sulla carta. 1–24 h: 50% sulla carta. Meno di 1 h o dopo: codice sconto al posto del rimborso. Richiesta non pagata: cancellazione libera. Dettagli nelle FAQ.",
    "checkoutPaymentMethodsNote": "Pagamento carta tramite iyzico (sicuro). Nessun contante. Apple Pay / Google Pay / PayPal con Stripe — lo annunceremo.",
    "checkoutFaqLink": "FAQ",
    "shopDetailInsuranceHint": "Copertura fino a 5.000 TL per pezzo secondo Termini — vedi FAQ.",
    "payBookingTitle": "Completa il pagamento",
    "payBookingSubtitle": "Paga in sicurezza con carta. Apple Pay, Google Pay o Link possono comparire se attivi in Stripe.",
    "payBookingSubmit": "Paga ora",
    "payBookingProcessing": "Elaborazione…",
    "payBookingFailed": "Pagamento non riuscito. Riprova.",
    "payBookingFinalizeFailed": "Pagamento ricevuto; la conferma può richiedere un attimo. Aggiorna la pagina.",
    "payBookingBack": "Torna alla prenotazione",
    "payBookingOpenCta": "Paga",
    "bookingDetailWaitingTitle": "In attesa di approvazione del negozio",
    "bookingDetailPaymentNeededTitle": "Pagamento richiesto",
    "bookingDetailPaymentNeededSub": "Il negozio ha approvato la richiesta. Completa il pagamento per confermare.",
    "bookingDetailPaymentNoStripeNote": "Stripe non è attivo in questo ambiente. Contatta il supporto o segui le istruzioni del negozio.",
    "bookingDetailQrAfterPayment": "Il QR code per il deposito compare qui dopo il pagamento.",
    "payBookingError_payments_disabled": "I pagamenti sono disattivati sulla piattaforma.",
    "payBookingError_gateway_not_stripe": "Stripe non attivo (PAYMENT_GATEWAY=stripe e chiavi richieste).",
    "payBookingError_stripe_not_configured": "Stripe non configurato (chiave segreta o pubblica mancante).",
    "payBookingError_booking_not_found": "Prenotazione non trovata o accesso negato.",
    "payBookingError_invalid_booking_status": "Questa prenotazione non è in attesa di pagamento.",
    "payBookingError_already_paid": "Questa prenotazione è già pagata.",
    "payBookingError_invalid_amount": "Importo non valido.",
    "payBookingError_stripe_no_client_secret": "Impossibile avviare il pagamento (Stripe).",
    "payBookingError_stripe_error": "Errore Stripe. Riprova più tardi.",
    "payBookingErrorUnknown": "Qualcosa è andato storto. Riprova o contatta il supporto.",
    "payBookingReturnSyncing": "Conferma del pagamento…",
    "payBookingReturnFailed": "Impossibile confermare il pagamento. Controlla lo stato o riprova.",
}

IT_FOOTER = {
    "citiesViewAll": "Tutte le città e le guide",
    "paymentsNote": "Carte tramite iyzico (sicuro). Nessun contante. Wallet (Apple/Google Pay, PayPal) previsti con Stripe.",
}

# --- Polacco ---
PL_FAQ = {
    "q1": "Czy mój bagaż jest bezpieczny?",
    "a1": "Tak. Sklepy partnerskie stosują się do zasad platformy; bagaże są plombowane i fotografowane przy odbiorze. Ochrona do 5 000 TL za sztukę według Regulaminu — to nie jest niezależna polisa detaliczna.",
    "q2": "Jak działają zwroty przy anulowaniu?",
    "a2": "Anulując co najmniej 24 godziny przed zameldowaniem — pełny zwrot na kartę. Między 1 a 24 godziną — 50% na kartę. Poniżej 1 godziny lub po czasie zameldowania — brak zwrotu na kartę; otrzymasz jednorazowy kod rabatowy na zapłaconą kwotę. Bez dokończonej płatności możesz bezpłatnie anulować w każdej chwili.",
    "q3": "Jakie metody płatności są akceptowane?",
    "a3": "Płatność online kartą przez bezpiecznego dostawcę (iyzico). Gotówka nie jest przyjmowana. Apple Pay, Google Pay i PayPal można włączyć przez Stripe — poinformujemy na stronie.",
    "q4": "Co jeśli sklep jest zamknięty lub potrzebuję pomocy?",
    "a4": "Skontaktuj się przez stronę kontaktową lub WhatsApp. Pomożemy zmienić termin, znaleźć inny punkt lub rozwiązać problem z rezerwacją.",
    "q5": "Co obejmuje pozycja ubezpieczenia przy płatności?",
    "a5": "Opłata przy płatności wspiera pakiet ochrony opisany w Regulaminie (do 5 000 TL za sztukę przy spełnieniu warunków). Zakres i wyłączenia w Regulaminie — przeczytaj przed rezerwacją.",
    "q6": "Jak działa rezerwacja?",
    "a6": "Wysyłasz prośbę z datami i rozmiarami bagaży. Sklep akceptuje. Następnie dokończenie płatności w razie potrzeby i kod QR przy odbiorze. To przepływ na prośbę — natychmiastowe potwierdzenie zależy od sklepu.",
    "q7": "Czy są rozmiary bagaży?",
    "a7": "Tak. Sloty S, M i XL z różnymi stawkami dziennymi. Bardzo duże przedmioty mogą wymagać akceptacji — zapytaj wsparcie przed rezerwacją.",
    "q8": "Czy przyjmujecie gotówkę?",
    "a8": "Nie. Tylko płatność kartą online (w przyszłości portfele), dla przejrzystości i zasad ochrony platformy.",
}

PL_GUEST = {
    "trustInsuranceBody": "Do 5 000 TL za sztukę według Regulaminu przy spełnieniu warunków; plomba i zdjęcie przy odbiorze. To nie jest niezależna polisa detaliczna.",
    "bagProtectionBody": "Przy płatności widać składkę ochronną według Regulaminu (do 5 000 TL za sztukę). Przeczytaj Regulamin i FAQ przed rezerwacją.",
    "cityHubViewAll": "Wszystkie miasta i przewodniki",
    "checkoutPolicyCalloutTitle": "Anulowanie — skrót",
    "checkoutPolicyCalloutBody": "24+ h przed zameldowaniem: pełny zwrot na kartę. 1–24 h: 50% na kartę. Poniżej 1 h lub po: jednorazowy kod zamiast zwrotu. Nieopłacona prośba: anuluj w dowolnym momencie. Szczegóły w FAQ.",
    "checkoutPaymentMethodsNote": "Płatność kartą przez iyzico (bezpiecznie). Bez gotówki. Apple Pay / Google Pay / PayPal ze Stripe — damy znać.",
    "checkoutFaqLink": "FAQ",
    "shopDetailInsuranceHint": "Ochrona do 5 000 TL za sztukę według Regulaminu — zobacz FAQ.",
    "payBookingTitle": "Dokończ płatność",
    "payBookingSubtitle": "Bezpieczna płatność kartą. Apple Pay, Google Pay lub Link mogą się pojawić, jeśli włączone w Stripe.",
    "payBookingSubmit": "Zapłać teraz",
    "payBookingProcessing": "Przetwarzanie…",
    "payBookingFailed": "Płatność nie powiodła się. Spróbuj ponownie.",
    "payBookingFinalizeFailed": "Płatność przyjęta; potwierdzenie może chwilę potrwać. Odśwież stronę.",
    "payBookingBack": "Wróć do rezerwacji",
    "payBookingOpenCta": "Zapłać",
    "bookingDetailWaitingTitle": "Oczekiwanie na akceptację sklepu",
    "bookingDetailPaymentNeededTitle": "Wymagana płatność",
    "bookingDetailPaymentNeededSub": "Sklep zaakceptował prośbę. Dokończ płatność, aby potwierdzić rezerwację.",
    "bookingDetailPaymentNoStripeNote": "Stripe nie jest włączony w tym środowisku. Skontaktuj się z pomocą lub zapłać według instrukcji sklepu.",
    "bookingDetailQrAfterPayment": "Kod QR do odbioru pojawi się tutaj po płatności.",
    "payBookingError_payments_disabled": "Płatności są obecnie wyłączone na platformie.",
    "payBookingError_gateway_not_stripe": "Stripe nieaktywny (PAYMENT_GATEWAY=stripe i klucze wymagane).",
    "payBookingError_stripe_not_configured": "Stripe nie jest skonfigurowany (brak klucza tajnego lub publicznego).",
    "payBookingError_booking_not_found": "Nie znaleziono rezerwacji lub brak dostępu.",
    "payBookingError_invalid_booking_status": "Ta rezerwacja nie oczekuje na płatność.",
    "payBookingError_already_paid": "Ta rezerwacja jest już opłacona.",
    "payBookingError_invalid_amount": "Nieprawidłowa kwota.",
    "payBookingError_stripe_no_client_secret": "Nie można rozpocząć płatności (Stripe).",
    "payBookingError_stripe_error": "Błąd Stripe. Spróbuj później.",
    "payBookingErrorUnknown": "Coś poszło nie tak. Spróbuj ponownie lub skontaktuj się z pomocą.",
    "payBookingReturnSyncing": "Potwierdzanie płatności…",
    "payBookingReturnFailed": "Nie udało się potwierdzić płatności. Sprawdź status lub spróbuj ponownie.",
}

PL_FOOTER = {
    "citiesViewAll": "Wszystkie miasta i przewodniki",
    "paymentsNote": "Karty przez iyzico (bezpiecznie). Bez gotówki. Portfele (Apple/Google Pay, PayPal) planowane ze Stripe.",
}

PATCHES = {
    "de": {"FAQ": DE_FAQ, "Guest": DE_GUEST, "Footer": DE_FOOTER},
    "fr": {"FAQ": FR_FAQ, "Guest": FR_GUEST, "Footer": {}},
    "es": {"FAQ": ES_FAQ, "Guest": ES_GUEST, "Footer": ES_FOOTER},
    "it": {"FAQ": IT_FAQ, "Guest": IT_GUEST, "Footer": IT_FOOTER},
    "pl": {"FAQ": PL_FAQ, "Guest": PL_GUEST, "Footer": PL_FOOTER},
}

PATCHES["fr"]["Footer"] = {
    "citiesViewAll": "Toutes les villes & guides",
    "paymentsNote": "Cartes via iyzico (sécurisé). Pas d’espèces. Portefeuilles (Apple/Google Pay, PayPal) prévus avec Stripe.",
}

RETURN_EN = {
    "payBookingReturnSyncing": "Confirming your payment…",
    "payBookingReturnFailed": "We couldn’t confirm the payment. Check your booking status or try again.",
}
RETURN_TR = {
    "payBookingReturnSyncing": "Ödemeniz onaylanıyor…",
    "payBookingReturnFailed": "Ödeme onaylanamadı. Rezervasyon durumunu kontrol edin veya tekrar deneyin.",
}


def main() -> None:
    for path in sorted(LOCALES.glob("*.json")):
        loc = path.stem
        data = json.loads(path.read_text(encoding="utf-8"))

        if loc in PATCHES:
            for ns, patch in PATCHES[loc].items():
                bucket = data.setdefault(ns, {})
                bucket.update(patch)

        g = data.setdefault("Guest", {})
        if loc == "tr":
            g.update(RETURN_TR)
        elif loc not in PATCHES:
            g.update(RETURN_EN)

        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print("Patched EU locales + return strings for all.")


if __name__ == "__main__":
    main()
