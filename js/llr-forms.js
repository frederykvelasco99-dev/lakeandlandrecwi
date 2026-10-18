// Sends a copy of every website form to Freddy's Gmail through Web3Forms (Netlify keeps its own copy too).
// The subject starts with "New form submission:" so the CRM's Gmail sync picks it up.
(function () {
  var KEY = 'WEB3FORMS_KEY_PENDING';
  window.llrEmailCopy = function (formName, data) {
    if (!KEY || /PENDING/.test(KEY)) return Promise.resolve();
    var body = { access_key: KEY, subject: 'New form submission: ' + formName, from_name: 'Lake & Land Rec website', 'form-name': formName };
    Object.keys(data || {}).forEach(function (k) { if (k !== 'bot-field' && k !== 'form-name') body[k] = data[k]; });
    if (body.email && !/^\S+@\S+\.\S+$/.test(body.email)) delete body.email;
    return fetch('https://api.web3forms.com/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) }).catch(function () {});
  };
})();
