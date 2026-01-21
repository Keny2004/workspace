/*URL: https://web-and-algo-prac-api.vercel.app/api/echo
Method: POST
Header: Content-Type: application/json
Body: { "name": "...", "message": "..." }
*/

async function sendMessage(name, message) {
  // 1. 使用 fetch 發送 POST
  // 2. 等待回應 (await)
  // 3. 回傳 JSON 物件 (return data)
    const data = { name:name, message:message};
    console.log(data);
    const response = await fetch('https://web-and-algo-prac-api.vercel.app/api/echo', {
    //const response = await fetch('https://jsonplaceholder.typicode.com/posts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });
    console.log(response);
    const result = await response.json();
    console.log(result);//hiii
    return result;//goodday
    
}
