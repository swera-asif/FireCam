// English and Urdu strings for the everyday app. Advanced/practice pages stay English.
const en={
  'tab.home':'Home','tab.alerts':'Alerts','tab.rooms':'Rooms','tab.family':'Family','tab.settings':'Settings',
  'status.safe':'All safe','status.check':'Check needed','status.alert':'Possible {what} in {room}',
  'status.safe.sub':'FireCam is listening and your family is set up.',
  'status.noRooms':'Add a room so FireCam knows what to listen to.',
  'status.noFamily':'Add one family phone number so someone can be reached.',
  'status.notListening':'Listening is off. Tap “Start listening” on this phone.',
  'status.roomOffline':'A room is not responding. Check its camera or phone.',
  'status.testDue':'Test your alerts. It has been a while since the last test.',
  'what.smoke':'smoke','what.co':'carbon monoxide','what.test':'test','what.practice':'practice alert',
  'home.listen.start':'Start listening','home.listen.stop':'Stop listening','home.listen.on':'Listening for smoke alarms','home.listen.off':'Not listening','home.listen.permission':'Waiting for microphone permission…','home.listen.lost':'Microphone was disconnected',
  'home.listen.help':'Keep this phone plugged in, in the room you want to watch, with the screen unlocked or the app open. FireCam listens for the beep pattern of a smoke or carbon-monoxide alarm.',
  'home.test':'Test my alerts','home.lastTest':'Last test: {days} days ago','home.lastTest.today':'Last test: today','home.lastTest.never':'Not tested yet',
  'home.rooms':'{n} rooms','home.room':'1 room','home.family':'{n} people','home.person':'1 person',
  'home.recent':'Recent alerts','home.none':'No alerts yet. That is good news.','home.seeAll':'See all alerts',
  'notice.short':'Not a certified fire detector. Keep your smoke alarms.',
  'notice.long':'FireCam is a helper, not a certified fire detector. It can miss a fire. Keep your real smoke alarms working and test them monthly.',
  'alert.title.smoke':'We think there’s smoke in the {room}.','alert.title.co':'We think there’s carbon monoxide in the {room}.','alert.title.test':'This is a test alert for the {room}.','alert.title.practice':'Practice alert for the {room}.',
  'alert.heard':'FireCam heard a smoke-alarm beep pattern.','alert.heard.co':'FireCam heard a carbon-monoxide-alarm beep pattern.','alert.manual':'You started this alert.',
  'alert.false':'It’s a false alarm','alert.callService':'Call fire service','alert.callFamily':'Call my family','alert.safe':'I’m safe, cancel','alert.textFamily':'Text my family',
  'alert.service.number':'{name}: {number}','alert.address':'Your address: {address}','alert.noAddress':'Add your home address in Settings so you can read it out quickly.',
  'alert.stage.owner':'Waiting for you to respond…','alert.stage.family':'No response in 30 seconds. Your family is being alerted.','alert.stage.service':'Still no response. Please call the fire service now.',
  'alert.sms':'FireCam alert: possible {what} in the {room} at {home}. {address} Please check now.',
  'alert.spoken.smoke':'Smoke detected in the {room}.','alert.spoken.co':'Carbon monoxide detected in the {room}.','alert.spoken.test':'This is a FireCam test alert.',
  'alert.closed':'Alert closed.','alert.test.done':'Test complete. Your alerts work on this phone.',
  'alerts.title':'Alerts','alerts.empty':'No alerts yet.','alerts.open':'Open',
  'history.smoke':'smoke in {room}.','history.co':'carbon monoxide in {room}.','history.test':'you tested your alerts in {room}.','history.practice':'practice alert in {room}.',
  'history.active':'Still open.','history.outcome.false':'You marked it as a false alarm.','history.outcome.cooking':'You marked it as cooking.','history.outcome.safe':'You said you were safe.','history.outcome.service':'You called the fire service.','history.outcome.test':'Everything worked.','history.outcome.unknown':'Closed.',
  'rooms.title':'Rooms','rooms.add':'Add a room','rooms.empty':'No rooms yet. Add the room where this phone or a camera will be.','rooms.phone':'This phone listens here','rooms.url':'Camera picture link','rooms.sample':'Sample room','rooms.remove':'Remove','rooms.removeConfirm':'Remove {room}?','rooms.removed':'Room removed.',
  'family.title':'Family','family.add':'Add a person','family.empty':'Nobody yet. Add one phone number.','family.owner':'You','family.member':'Family','family.call':'Call','family.remove':'Remove','family.removeConfirm':'Remove {name}?','family.saved':'Saved.','family.name':'Name','family.phone':'Phone number','family.phoneHelp':'Include the country code, for example +92 300 1234567.','family.invalid':'Enter a real phone number with the country code, for example +92 300 1234567.',
  'setup.title':'Set up FireCam','setup.step':'Step {n} of 3','setup.1.title':'Where should FireCam listen?','setup.1.phone':'Use this phone','setup.1.phone.sub':'This phone listens for alarm beeps with its microphone.','setup.1.url':'Camera picture link','setup.1.url.sub':'A snapshot address from a Wi‑Fi camera (optional).','setup.1.urlField':'Picture link (http…)',
  'setup.2.title':'Name the room','setup.2.field':'Room name','setup.2.example':'Kitchen','setup.3.title':'Add one phone number','setup.3.sub':'The person FireCam should tell first. You can add more later.','setup.next':'Next','setup.back':'Back','setup.done':'Done','setup.skip':'Skip for now',
  'setup.permission':'Allow microphone and notifications when asked. FireCam does not record or send any sound.',
  'settings.title':'Settings','settings.home':'Home name','settings.address':'Home address','settings.addressHelp':'Shown on every alert so you can read it to the fire service.','settings.country':'Country','settings.service':'Fire service number','settings.serviceHelp':'Leave empty to use the number for your country.','settings.language':'Language','settings.largeText':'Large text','settings.theme':'Theme','settings.theme.light':'Light','settings.theme.dark':'Dark','settings.save':'Save','settings.saved':'Settings saved.',
  'settings.advanced':'Advanced & practice','settings.advanced.sub':'Tools for curious users. Nothing here is needed day to day.','settings.practice':'Practice mode (incident simulator)','settings.lab':'Detection lab (camera experiments)','settings.voice':'Voice & recordings','settings.floor':'Floor plan','settings.history':'Practice history','settings.playAlarm':'Play a smoke-alarm sound (8 s)','settings.playAlarm.help':'Hold a second phone with FireCam listening nearby to check detection.','settings.reset':'Reset everything…',
  'common.cancel':'Cancel','common.confirm':'Confirm','common.close':'Close','common.save':'Save','common.back':'Back'
};
const ur={
  'tab.home':'ہوم','tab.alerts':'الرٹس','tab.rooms':'کمرے','tab.family':'خاندان','tab.settings':'ترتیبات',
  'status.safe':'سب محفوظ ہے','status.check':'توجہ درکار ہے','status.alert':'{room} میں {what} کا امکان',
  'status.safe.sub':'FireCam سن رہا ہے اور آپ کا خاندان شامل ہے۔',
  'status.noRooms':'ایک کمرہ شامل کریں تاکہ FireCam جان سکے کہاں سننا ہے۔',
  'status.noFamily':'کم از کم ایک فون نمبر شامل کریں تاکہ کسی سے رابطہ ہو سکے۔',
  'status.notListening':'سننا بند ہے۔ اس فون پر ”سننا شروع کریں“ دبائیں۔',
  'status.roomOffline':'ایک کمرہ جواب نہیں دے رہا۔ اس کا کیمرہ یا فون چیک کریں۔',
  'status.testDue':'اپنے الرٹس ٹیسٹ کریں۔ آخری ٹیسٹ کو کافی عرصہ ہو گیا ہے۔',
  'what.smoke':'دھواں','what.co':'کاربن مونو آکسائیڈ','what.test':'ٹیسٹ','what.practice':'مشقی الرٹ',
  'home.listen.start':'سننا شروع کریں','home.listen.stop':'سننا بند کریں','home.listen.on':'دھوئیں کے الارم سن رہا ہے','home.listen.off':'نہیں سن رہا','home.listen.permission':'مائیکروفون کی اجازت کا انتظار…','home.listen.lost':'مائیکروفون منقطع ہو گیا',
  'home.listen.help':'اس فون کو چارجنگ پر، اسی کمرے میں رکھیں جس پر نظر رکھنی ہے، اور ایپ کھلی رکھیں۔ FireCam دھوئیں یا کاربن مونو آکسائیڈ کے الارم کی بیپ کا انداز سنتا ہے۔',
  'home.test':'میرے الرٹس ٹیسٹ کریں','home.lastTest':'آخری ٹیسٹ: {days} دن پہلے','home.lastTest.today':'آخری ٹیسٹ: آج','home.lastTest.never':'ابھی ٹیسٹ نہیں ہوا',
  'home.rooms':'{n} کمرے','home.room':'1 کمرہ','home.family':'{n} افراد','home.person':'1 فرد',
  'home.recent':'حالیہ الرٹس','home.none':'ابھی کوئی الرٹ نہیں۔ یہ اچھی خبر ہے۔','home.seeAll':'تمام الرٹس دیکھیں',
  'notice.short':'یہ تصدیق شدہ فائر ڈیٹیکٹر نہیں ہے۔ اپنے سموک الارم لگائے رکھیں۔',
  'notice.long':'FireCam ایک مددگار ہے، تصدیق شدہ فائر ڈیٹیکٹر نہیں۔ یہ آگ کو نظرانداز کر سکتا ہے۔ اپنے اصلی سموک الارم چالو رکھیں اور ہر ماہ ٹیسٹ کریں۔',
  'alert.title.smoke':'ہمیں لگتا ہے {room} میں دھواں ہے۔','alert.title.co':'ہمیں لگتا ہے {room} میں کاربن مونو آکسائیڈ ہے۔','alert.title.test':'یہ {room} کے لیے ٹیسٹ الرٹ ہے۔','alert.title.practice':'{room} کے لیے مشقی الرٹ۔',
  'alert.heard':'FireCam نے سموک الارم کی بیپ سنی۔','alert.heard.co':'FireCam نے کاربن مونو آکسائیڈ الارم کی بیپ سنی۔','alert.manual':'آپ نے یہ الرٹ شروع کیا۔',
  'alert.false':'یہ جھوٹا الارم ہے','alert.callService':'فائر سروس کو کال کریں','alert.callFamily':'گھر والوں کو کال کریں','alert.safe':'میں محفوظ ہوں، منسوخ کریں','alert.textFamily':'گھر والوں کو پیغام بھیجیں',
  'alert.service.number':'{name}: {number}','alert.address':'آپ کا پتہ: {address}','alert.noAddress':'ترتیبات میں گھر کا پتہ شامل کریں تاکہ آپ اسے جلدی بتا سکیں۔',
  'alert.stage.owner':'آپ کے جواب کا انتظار…','alert.stage.family':'30 سیکنڈ میں جواب نہیں ملا۔ آپ کے گھر والوں کو خبر دی جا رہی ہے۔','alert.stage.service':'ابھی تک جواب نہیں۔ براہ کرم ابھی فائر سروس کو کال کریں۔',
  'alert.sms':'FireCam الرٹ: {home} کے {room} میں {what} کا امکان۔ {address} براہ کرم ابھی چیک کریں۔',
  'alert.spoken.smoke':'{room} میں دھواں محسوس ہوا ہے۔','alert.spoken.co':'{room} میں کاربن مونو آکسائیڈ محسوس ہوئی ہے۔','alert.spoken.test':'یہ FireCam کا ٹیسٹ الرٹ ہے۔',
  'alert.closed':'الرٹ بند ہو گیا۔','alert.test.done':'ٹیسٹ مکمل۔ اس فون پر آپ کے الرٹس کام کرتے ہیں۔',
  'alerts.title':'الرٹس','alerts.empty':'ابھی کوئی الرٹ نہیں۔','alerts.open':'کھولیں',
  'history.smoke':'{room} میں دھواں۔','history.co':'{room} میں کاربن مونو آکسائیڈ۔','history.test':'آپ نے {room} میں الرٹس ٹیسٹ کیے۔','history.practice':'{room} میں مشقی الرٹ۔',
  'history.active':'ابھی کھلا ہے۔','history.outcome.false':'آپ نے اسے جھوٹا الارم قرار دیا۔','history.outcome.cooking':'آپ نے اسے کھانا پکانا قرار دیا۔','history.outcome.safe':'آپ نے کہا آپ محفوظ ہیں۔','history.outcome.service':'آپ نے فائر سروس کو کال کی۔','history.outcome.test':'سب کچھ ٹھیک کام کیا۔','history.outcome.unknown':'بند۔',
  'rooms.title':'کمرے','rooms.add':'کمرہ شامل کریں','rooms.empty':'ابھی کوئی کمرہ نہیں۔ وہ کمرہ شامل کریں جہاں یہ فون یا کیمرہ ہوگا۔','rooms.phone':'یہ فون یہاں سنتا ہے','rooms.url':'کیمرے کی تصویر کا لنک','rooms.sample':'نمونہ کمرہ','rooms.remove':'ہٹائیں','rooms.removeConfirm':'{room} ہٹائیں؟','rooms.removed':'کمرہ ہٹا دیا گیا۔',
  'family.title':'خاندان','family.add':'فرد شامل کریں','family.empty':'ابھی کوئی نہیں۔ ایک فون نمبر شامل کریں۔','family.owner':'آپ','family.member':'خاندان','family.call':'کال','family.remove':'ہٹائیں','family.removeConfirm':'{name} کو ہٹائیں؟','family.saved':'محفوظ ہو گیا۔','family.name':'نام','family.phone':'فون نمبر','family.phoneHelp':'ملک کا کوڈ شامل کریں، مثلاً ‎+92 300 1234567۔','family.invalid':'ملک کے کوڈ کے ساتھ درست فون نمبر درج کریں، مثلاً ‎+92 300 1234567۔',
  'setup.title':'FireCam سیٹ اپ کریں','setup.step':'مرحلہ {n} از 3','setup.1.title':'FireCam کہاں سنے؟','setup.1.phone':'یہ فون استعمال کریں','setup.1.phone.sub':'یہ فون اپنے مائیکروفون سے الارم کی بیپ سنتا ہے۔','setup.1.url':'کیمرے کی تصویر کا لنک','setup.1.url.sub':'وائی فائی کیمرے کی تصویر کا پتہ (اختیاری)۔','setup.1.urlField':'تصویر کا لنک (http…)',
  'setup.2.title':'کمرے کا نام رکھیں','setup.2.field':'کمرے کا نام','setup.2.example':'باورچی خانہ','setup.3.title':'ایک فون نمبر شامل کریں','setup.3.sub':'وہ شخص جسے FireCam سب سے پہلے بتائے۔ مزید بعد میں شامل کر سکتے ہیں۔','setup.next':'اگلا','setup.back':'واپس','setup.done':'مکمل','setup.skip':'ابھی چھوڑ دیں',
  'setup.permission':'پوچھے جانے پر مائیکروفون اور اطلاعات کی اجازت دیں۔ FireCam کوئی آواز ریکارڈ یا نہیں بھیجتا۔',
  'settings.title':'ترتیبات','settings.home':'گھر کا نام','settings.address':'گھر کا پتہ','settings.addressHelp':'ہر الرٹ پر دکھایا جاتا ہے تاکہ آپ فائر سروس کو بتا سکیں۔','settings.country':'ملک','settings.service':'فائر سروس نمبر','settings.serviceHelp':'اپنے ملک کا نمبر استعمال کرنے کے لیے خالی چھوڑیں۔','settings.language':'زبان','settings.largeText':'بڑا متن','settings.theme':'تھیم','settings.theme.light':'روشن','settings.theme.dark':'تاریک','settings.save':'محفوظ کریں','settings.saved':'ترتیبات محفوظ ہو گئیں۔',
  'settings.advanced':'ایڈوانسڈ اور مشق','settings.advanced.sub':'متجسس صارفین کے لیے ٹولز۔ روزمرہ کے لیے ان کی ضرورت نہیں۔','settings.practice':'مشقی موڈ (واقعہ سمیولیٹر)','settings.lab':'ڈیٹیکشن لیب (کیمرہ تجربات)','settings.voice':'آواز اور ریکارڈنگز','settings.floor':'فلور پلان','settings.history':'مشقی تاریخ','settings.playAlarm':'سموک الارم کی آواز چلائیں (8 سیکنڈ)','settings.playAlarm.help':'قریب میں دوسرا فون FireCam کے ساتھ سنتا ہوا رکھیں تاکہ ڈیٹیکشن چیک ہو۔','settings.reset':'سب کچھ ری سیٹ کریں…',
  'common.cancel':'منسوخ','common.confirm':'تصدیق','common.close':'بند کریں','common.save':'محفوظ کریں','common.back':'واپس'
};
export const languages={en:{name:'English',locale:'en-GB',speech:'en-GB',dir:'ltr'},ur:{name:'اردو',locale:'ur-PK',speech:'ur-PK',dir:'rtl'}};
const dictionaries={en,ur};
let current='en';
export function setLanguage(code){current=dictionaries[code]?code:'en';return current;}
export const language=()=>current;
export const locale=()=>languages[current].locale;
export function t(key,vars={}){
  const text=dictionaries[current][key]??en[key]??key;
  return text.replace(/\{(\w+)\}/g,(_,k)=>vars[k]??'');
}
export const missingKeys=()=>Object.keys(en).filter(k=>!(k in ur));
