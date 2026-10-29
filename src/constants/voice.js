export const FILIPINO_VOICE = Object.freeze({
  greetingMorning: Object.freeze({
    id: 'greeting-morning',
    phrase: 'Magandang umaga, {name}!',
    englishMeaning: 'Good morning, {name}!',
    allowedPlacement: 'Signed-in customer home greeting',
  }),
  greetingNoon: Object.freeze({
    id: 'greeting-noon',
    phrase: 'Magandang tanghali, {name}!',
    englishMeaning: 'Good day, {name}!',
    allowedPlacement: 'Signed-in customer home greeting',
  }),
  greetingAfternoon: Object.freeze({
    id: 'greeting-afternoon',
    phrase: 'Magandang hapon, {name}!',
    englishMeaning: 'Good afternoon, {name}!',
    allowedPlacement: 'Signed-in customer home greeting',
  }),
  greetingEvening: Object.freeze({
    id: 'greeting-evening',
    phrase: 'Magandang gabi, {name}!',
    englishMeaning: 'Good evening, {name}!',
    allowedPlacement: 'Signed-in customer home greeting',
  }),
  kainTayo: Object.freeze({
    id: 'kain-tayo',
    phrase: 'Kain tayo!',
    englishMeaning: 'Let’s eat!',
    allowedPlacement: 'Landing page hero kicker',
  }),
  taraNa: Object.freeze({
    id: 'tara-na',
    phrase: 'Tara na!',
    englishMeaning: 'Let’s go!',
    allowedPlacement: 'Empty cart friendly prompt',
  }),
  saluSaloFriends: Object.freeze({
    id: 'salu-salo-friends',
    phrase: 'Salu-salo with your friends!',
    englishMeaning: 'A meal together with your friends!',
    allowedPlacement: 'Public reservation promo subhead',
  }),
  masarap: Object.freeze({
    id: 'masarap',
    phrase: 'Masarap!',
    englishMeaning: 'Delicious!',
    allowedPlacement: 'Order or reservation confirmation',
  }),
  salamat: Object.freeze({
    id: 'salamat',
    phrase: 'Salamat!',
    englishMeaning: 'Thank you!',
    allowedPlacement: 'Friendly success or confirmation moment',
  }),
  sulit: Object.freeze({
    id: 'sulit',
    phrase: 'Sulit!',
    englishMeaning: 'Worth it!',
    allowedPlacement: 'Short promotional accent',
  }),
  hanggangSaMuli: Object.freeze({
    id: 'hanggang-sa-muli',
    phrase: 'Hanggang sa muli!',
    englishMeaning: 'Until next time!',
    allowedPlacement: 'Friendly sign-off',
  }),
});

export function getGreeting(date = new Date(), name = 'there') {
  const hourPart = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date).find((part) => part.type === 'hour');
  const hour = Number(hourPart.value);
  let greeting;

  if (hour >= 5 && hour <= 10) greeting = FILIPINO_VOICE.greetingMorning;
  else if (hour >= 11 && hour <= 12) greeting = FILIPINO_VOICE.greetingNoon;
  else if (hour >= 13 && hour <= 17) greeting = FILIPINO_VOICE.greetingAfternoon;
  else greeting = FILIPINO_VOICE.greetingEvening;

  return greeting.phrase.replace('{name}', name);
}
