const fs = require('fs');
const fetch = require('node-fetch');
const markdownTable = require('markdown-table');

const data = fs.readFileSync('./mirror-original.csv');
const rows = data.toString().split('\n');

const table = rows
  .map(row => row.split(',').map(column => column.trim()))
  .filter((row, i) => row.length === 4 && i !== 0)
  .map(row => row.push(-1) && row) // row[4] to store count of RSS subscribers

async function getLatestSubstatsRes(feedUrl, cacheFilename) {
  const substatsAPI = `https://api.spencerwoo.com/substats/?source=feedly|inoreader|feedsPub&queryKey=${feedUrl}`;

  try {
    const substatsRes = await fetch(substatsAPI, { timeout: 5000 }); // wait for 5s
    let data = await substatsRes.json();
    if (data.status === 200) {
      // Mark lastModified
      data['lastModified'] = new Date().getTime();
      const totalSubs = data.data.totalSubs;
      // Save to cache
      fs.writeFileSync(cacheFilename, JSON.stringify(data));
      return totalSubs;
    } else {
      return -1;
    }
  } catch (err) {
    console.log(`Failed to fetch: ${feedUrl}`);
    throw err;
  }
}

async function getTotalSubs(feedUrl, index) {
  const cacheFilename = `./cache/${encodeURIComponent(feedUrl)}.json`;
  let totalSubs = -1;
  let fromCache = false;

  if (fs.existsSync(cacheFilename)) {
    const cachedRes = JSON.parse(fs.readFileSync(cacheFilename, 'utf8'));
    // cache available within 5 days
    const cacheExpired = 86400 * 1000 * 5 < (new Date().getTime() - parseInt(cachedRes.lastModified)) ? true : false;

    totalSubs = !cacheExpired ?
      cachedRes.data.totalSubs :
      await getLatestSubstatsRes(feedUrl, cacheFilename);
    fromCache = !cacheExpired;
  } else {
    totalSubs = await getLatestSubstatsRes(feedUrl, cacheFilename);
  }

  return { feedUrl, index, totalSubs, fromCache };
}


async function getResultAndUpdateREADME() {
  const feedTable = table
    .map((row, index) => row.push(index) && row) // row[5]: original table index
    .filter(row => row[2]) // Have RSS

  while(feedTable.length) {
    const resPromise = [];

    feedTable.splice(-20, 20).forEach(row => {
      resPromise.push(getTotalSubs(row[2], row[5]));
    })

    await Promise.allSettled(resPromise).then(responses => {
      responses.forEach(res => {
        if (res.status === 'fulfilled') { // succeeded
          // console.debug(`INFO: ${JSON.stringify(res.value)}`);
          table[res.value.index][4] = res.value.totalSubs;
        }
        if (res.status === 'rejected') { // failed
          // no-op
        }
      })
    })
  }

  // Sort by RSS subscribers count first, then by alphanumeric
  table.sort((a, b) => (b[4] - a[4]) || (a[0] - b[0]));

  const newTable = table.map(row => {
    const subscribeCount = row[4] >= 1000 ? row[4] : (row[4] + '').replace(/\d/g, '*');
    return [
      row[4] >= 0 ? `[![](https://badgen.net/badge/icon/${subscribeCount}?icon=rss&label)](${row[2]})` : '',
      row[0].replace(/\|/g, '&#124;'),
      row[1],
      row[3]
    ]
  });

  // update README
  const tableContentInMD = markdownTable([['RSS 订阅数', '简介', '链接', '标签'], ...newTable]);

  const readmeContent = `
# 优质 Mirror 信息源列表

  [![](https://badgen.net/badge/icon/Website?icon=chrome&label)](https://dbarobin.com/) [![](https://badgen.net/badge/icon/Twitter?icon=twitter&label)](https://twitter.com/vrwio)

## 目录

- [Mirror 信息源列表](#Mirror-信息源列表)
- [什么是 Mirror](#什么是-Mirror)
  - [如何提交](#如何提交)
- [为什么要收集这张列表](#为什么要收集这张列表)

## Mirror 信息源列表

> 暂时根据各 RSS 服务订阅数据排了个先后顺序。

${tableContentInMD}

## 什么是 Mirror

- 最佳的 Web3 内容平台

### 如何提交

1. 在 [./mirror-original.csv](./mirror-original.csv) 中填入 Mirror 的 名称、URL、RSS 以及标签
2. 提交 PR
3. (自动) PR 被 merge 之后 README 通过 [./script.js](./script.js) 生成

Mirror 的 RSS 链接需要做一下说明。

- Mirror 现在有两种格式的链接，一种是 https://xxx.mirror.xyz，另一种是 https://mirror.xyz/xxx；
- 如果是 https://xxx.mirror.xyz，RSS 的订阅链接是 https://xxx.submirror.xyz/；
- 如果是 https://mirror.xyz/xxx，RSS 的订阅链接是 https://submirror.xyz/xxx。

## 为什么要收集这张列表

Mirror 上的内容比较分散，有了 submirror.xyz 的加持，得以让 Mirror 支持 RSS 订阅成为可能。这个列表就是让 Web3 参与者快速地找到信息源。

## Thanks

- [chinese-independent-blogs](https://github.com/timqian/chinese-independent-blogs)
- [@wonderfuly](https://twitter.com/wonderfuly)
`

  fs.writeFileSync('./README.md', readmeContent, 'utf8');

}

getResultAndUpdateREADME()