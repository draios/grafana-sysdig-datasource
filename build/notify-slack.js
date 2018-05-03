const http = require('http');
const url = require("url");

const slackUrl = process.argv[2];
const version = process.argv[3];
const buildNumber = process.argv[4];
const branchName = process.argv[5];
const buildUrl = process.argv[6];
const result = process.argv[7];
const startTime = process.argv[8];
const duration = process.argv[9];
const gitCommitHash = process.argv[10];

const colors = {
    bad: '#FF871E',
    veryBad: '#EB3250',
    good: '#55EB5A',
    unknown: '#B3C3C6',
};

let title;
let text;
let color;
switch (result) {
    case 'SUCCESS':
        title = 'Build succeeded';
        text = `The build #${buildNumber} succeeded in ${duration / 1000} seconds.`;
        color = colors.good;
        break;

    // case 'REGRESSION':
    //     title = "Build failed";
    //     text = `The build ${buildNumber} failed for the first time in ${duration / 1000} seconds.`;
    //     color = colors.veryBad;
    //     break;

    case 'FAILURE':
        title = "Build failed";
        text = `The build #${buildNumber} failed in ${duration / 1000} seconds.`;
        color = colors.bad;
        break;
    case 'ABORTED':
        title = "Build aborted";
        text = `The build #${buildNumber} has been aborted in ${duration / 1000} seconds.`;
        color = colors.unknown;
        break;
    case 'UNSTABLE':
        title = "Build unstable";
        text = `The build #${buildNumber} is unstable in ${duration / 1000} seconds.`;
        color = colors.bad;
        break;

    case 'FIXED':
        title = "Build fixed";
        text = `The build #${buildNumber} got fixed in ${duration / 1000} seconds.`;
        color = colors.good;
        break;

    default:
        title = "Build terminated";
        text = `The build #${buildNumber} terminated with result ${result} in ${duration / 1000} seconds.`;
        break;
}

const json = {
    channel: '#grafana-ds-activity',
    username: 'jenkins',
    attachments: [
		{
			color,
            title,
            title_link: buildUrl,
			text,
			fallback: text,
			fields: [
				{
					title: 'Build number',
					value: buildNumber,
					short: true
				},
				{
					title: 'Version',
					value: version,
					short: true
				},
				{
					title: 'Repository and branch',
					value: `https://github.com/draios/grafana-sysdig-datasource/tree/${branchName}`,
					short: false
				},
				{
					title: 'Latest commit',
					value: `https://github.com/draios/grafana-sysdig-datasource/commit/${gitCommitHash}`,
					short: false
                }
			],
			footer: 'Built by Jenkins',
			ts: startTime / 1000
		}
	]
};

const postData = JSON.stringify(json);
const urlObj = url.parse(slackUrl);
const options = {
    hostname: `${urlObj.protocol}//${urlObj.hostname}`,
    path: urlObj.pathname,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};
const req = http.request(options, res => {
    res.on('end', () => {
        process.exit(0);
    });
});

req.on('error', e => {
    console.error(`Slack notification failed: ${e.message}`);
    process.exit(1);
});

console.log(options);
console.log(postData);
req.write(postData);
req.end();

// request.post(
//     slackUrl,
//     { json },
//     (err, res, body) => {
//         if (err) {
//             console.log(err);
//             process.exit(1);
//         } else {
//             process.exit(0);
//         }
//     }
// );

