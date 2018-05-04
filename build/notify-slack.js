const https = require('https');
const url = require('url');

const slackUrl = process.argv[2];
const version = process.argv[3];
const buildNumber = process.argv[4];
const branchName = process.argv[5];
const buildUrl = process.argv[6];
const previousResult = process.argv[7];
const result = process.argv[8];
const startTime = process.argv[9];
const duration = process.argv[10];
const gitCommitHash = process.argv[11];

const colors = {
    bad: '#FF871E',
    veryBad: '#EB3250',
    warning: '#FAFA3C',
    good: '#55EB5A',
    unknown: '#B3C3C6',
};

const changeAnalysis = analyzeChange(previousResult, result);

if (
    branchName !== 'master' &&
    changeAnalysis.isFirstBuild === false &&
    changeAnalysis.isSuccessful &&
    changeAnalysis.isFirstSuccess === false
) {
    // No need to post the successful message again
    process.exit(0);
}

let title;
let text;
let color;
switch (result) {
    case 'SUCCESS':
        title = 'Build succeeded';
        text = `The build #${buildNumber} succeeded in ${duration / 1000} seconds.`;
        color = colors.good;
        break;

    case 'FAILURE':
        title = "Build failed";
        text = `The build #${buildNumber} failed in ${duration / 1000} seconds.`;
        color = colors.bad;
        break;
    case 'ABORTED':
        title = "Build aborted";
        text = `The build #${buildNumber} has been aborted in ${duration / 1000} seconds.`;
        color = colors.warning;
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
    hostname: urlObj.hostname,
    path: urlObj.pathname,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};
const req = https.request(options, res => {
    res.on('end', () => {
        process.exit(0);
    });
});

req.on('error', e => {
    console.error(`Slack notification failed: ${e.message}`);
    process.exit(1);
});

req.write(postData);
req.end();


function analyzeChange(previousResult, result) {
    switch (result) {
        case 'SUCCESS':
        case 'FIXED':
            switch (previousResult) {
                case 'SUCCESS':
                case 'FIXED':
                    return {
                        isFirstBuild: false,
                        isFirstFailure: false,
                        isFirstSuccess: false,
                        isSuccessful: true,
                    };
                case 'FAILURE':
                case 'ABORTED':
                case 'UNSTABLE':
                    return {
                        isFirstBuild: false,
                        isFirstFailure: false,
                        isFirstSuccess: true,
                        isSuccessful: true,
                    };

                case 'NONE':
                    return {
                        isFirstBuild: true,
                        isFirstFailure: false,
                        isFirstSuccess: true,
                        isSuccessful: true,
                    };

                default:
                    return {
                        isFirstBuild: false,
                        isFirstFailure: false,
                        isFirstSuccess: false,
                        isSuccessful: true,
                    };
            }

        case 'FAILURE':
        case 'ABORTED':
        case 'UNSTABLE':
            switch (previousResult) {
                case 'SUCCESS':
                case 'FIXED':
                    return {
                        isFirstBuild: false,
                        isFirstFailure: true,
                        isFirstSuccess: false,
                        isSuccessful: false,
                    };
                case 'FAILURE':
                case 'ABORTED':
                case 'UNSTABLE':
                    return {
                        isFirstBuild: false,
                        isFirstFailure: false,
                        isFirstSuccess: false,
                        isSuccessful: false,
                    };

                case 'NONE':
                    return {
                        isFirstBuild: true,
                        isFirstFailure: false,
                        isFirstSuccess: true,
                        isSuccessful: true,
                    };

                default:
                    return {
                        isFirstBuild: false,
                        isFirstFailure: false,
                        isFirstSuccess: false,
                        isSuccessful: false,
                    };
            }

        default:
            return {
                isFirstBuild: false,
                isFirstFailure: false,
                isFirstSuccess: false,
                isSuccessful: false,
            };
    }
}