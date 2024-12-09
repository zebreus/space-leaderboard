import { DOMParser } from "jsr:@b-fuze/deno-dom";

type SpaceState = {
    score: number;
    name: string;
    url: string;
    heatmapUrl: string;
};

const generateData = async () => {
const directory = await fetch("https://directory.spaceapi.io/")
const directoryJson = await  directory.json()
let spaces = Object.entries(directoryJson).map(([name, url]) => ({
    name,
    url: url as string
}))
// spaces = [spaces[0]]

console.log(`Found ${spaces.length} hackspaces`)

const getSpaceScore = async (spacename:string) => {
    const sanitized_name = spacename.replaceAll(/ /g, "+");
    const url = `https://mapall.space/heatmap/show.php?id=${sanitized_name}`;
    console.log(`Fetching ${url}`)
    const textResponse = await fetch(url);
      const textData = await textResponse.text();

    //   console.log(textData)
      const dom = new DOMParser().parseFromString(textData, "text/html");

      const avgsLastMonth = [...dom.querySelectorAll('*[name="maand"]+*+table.heatmap tbody tr:last-child td')];
      const avgsNums = avgsLastMonth.map(e => e.textContent ?? "").filter(e=>e).map(e => parseFloat(e)).filter(e=>!Number.isNaN(e))
      const score = avgsNums.reduce((total, thiss) => total + thiss) / avgsNums.length

      return {
        score,
        heatmapUrl: url
    }
}

const states = spaces.map(({name, url}, index) => {
    const result = (async () => {
        await (new Promise((resolve) => setTimeout(resolve, 5000 * index)))
    try {
        const {score, heatmapUrl} = await getSpaceScore(name)
        console.error(`Fetched score ${score} for ${name}`)
        return {
            score,
            name,
            url,
            heatmapUrl
        }

    } catch(e){
        console.error( `Failed to fetch data for ${name}: ${e}`)
        throw `Failed to fetch data for ${name}: ${e}`
    }
})()
return result
})


const settledStates = await Promise.allSettled(states)
const spacesWithScores = settledStates.flatMap((settledPromise) => {
    if (settledPromise.status == "rejected") {
        console.error(settledPromise.reason)
        return []
    }
   return [settledPromise.value]
})

console.log(spacesWithScores)
await Deno.writeTextFile("scores.json",JSON.stringify(spacesWithScores))
}

const loadData = async () => {
    const data = await Deno.readTextFile("scores.json")
    const jsonData = JSON.parse(data) as SpaceState[]
    return jsonData
}



const sanitizeData = (data: SpaceState[]) => {
    const sanitizedData = data.map((hackspace) => {
        if (hackspace.score == 100) {
            // If they were literally never closed, they get disqualified from the leaderboard
            return {
                ...hackspace,
                score: -1,
                disqualified: "Stats seem invalid as the space was literally open at all times last month"
            }
        }
        return {...hackspace,
            disqualified: ""
        }
    })
    return sanitizedData
}

const generateHtml = async () => {
    const unsanitizedData = await loadData();
    const data = sanitizeData(unsanitizedData)
    const sortedData = data.toSorted((a,b) => b.score - a.score)
    const content = sortedData.map(({
        name, score, heatmapUrl, disqualified = ""
    }, index) => `<li href="${heatmapUrl}">${index}. <a href="${heatmapUrl}">${name}</a>: ${disqualified || `${score.toFixed(2)}%`}</li>`).join("\n")
    const html =  `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="stylesheet" href="index.css">
  <title>Hackspace Leaderboard!</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="description" content="" />
  <link rel="icon" href="favicon.png">
</head>
<body>
  <h1>Leaderboard of the best hackspaces</h1>
  <ol>
  ${content}
  </ol>
</body>
</html>`

await Deno.writeTextFile("index.html", html)
}

// await generateData()
await generateHtml();
