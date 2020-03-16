const crypto = require("crypto");
const qs = require("qs");
const fetch = require("node-fetch");
const dayjs = require("dayjs");
const {PubSub} = require("@google-cloud/pubsub");
const {format} = require("timeago.js");

function isValidRequest(req) {
  // veryfy request from slack
  // https://api.slack.com/docs/verifying-requests-from-slack
  const timestamp = req.get("X-Slack-Request-Timestamp");
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 60 * 5) { // 5 minutes
    return false;
  }
  const body = qs.stringify(req.body);
  const mySignature =
      "v0=" + crypto.createHmac("SHA256", process.env.SIGNING_SECRET)
                  .update([ "v0", timestamp, body ].join(":"))
                  .digest("hex");
  const slackSignature = req.get("X-Slack-Signature");
  return crypto.timingSafeEqual(Buffer.from(mySignature),
                                Buffer.from(slackSignature));
}

exports.lastAccepted = (req, res) => {
  if (!isValidRequest(req)) {
    res.sendStatus(400);
    return;
  }
  // https://cloud.google.com/pubsub/docs/publisher#publish-messages-to-a-topic
  const pubsub = new PubSub();
  const topicName = "AtCoderProblems";
  const data = JSON.stringify(req.body);
  const dataBuffer = Buffer.from(data);
  // const messageId = await pubsub.topic(topicName).publish(dataBuffer);
  pubsub.topic(topicName).publish(dataBuffer);
  res.send({
    response_type : "in_channel",
    text : `OK. AtCoder Username: ${req.body.text}`,
  });
};

function send(url, txt) {
  fetch(url, {
    method : "POST",
    headers : {"Content-Type" : "application/json"},
    body : JSON.stringify({
      response_type : "in_channel",
      text : txt,
    }),
  });
}

exports.sendSlack = async (pubsubMessage) => {
  // https://cloud.google.com/pubsub/docs/reference/rest/v1/PubsubMessage?hl=ja
  const data = JSON.parse(Buffer.from(pubsubMessage.data, 'base64'));
  const url = data.response_url;
  const username = data.text;
  let json = [];
  try {
    const resp = await fetch(
        `https://kenkoooo.com/atcoder/atcoder-api/results?user=${username}`);
    json = await resp.json();
  } catch (err) {
    console.error(err);
    send(url, `Sorry. Failed to get ${username}'s submissions.`);
    return;
  }
  // AC した時刻の降順にソート
  const accepted =
      json.filter(s => s.result === "AC")
          .sort((x, y) => { return y.epoch_second - x.epoch_second; });
  const s = accepted[0];
  const contest = `https://atcoder.jp/contests/${s.contest_id}`;
  const detail = contest + `/submissions/${s.id}`;
  const problem = contest + `/tasks/${s.problem_id}`;
  let title = "???";
  try {
    const resp_html = await fetch(problem);
    const text = await resp_html.text();
    title = text.match(/<title>(.+)<\/title>/m)[1] || "???";
  } catch (err) { console.error(err); }
  const point = s.point;
  const date = dayjs.unix(s.epoch_second).format('YYYY-MM-DD HH:mmZ');
  const diff = format(s.epoch_second * 1000);

  send(url, `<@${data.user_name}> ${username}'s last AC: ` +
                `${title} (${point}pts) ${detail} ${date} (${diff})`);
};
