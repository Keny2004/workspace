function getWarriors(data){
   // return data.filter(data => data.role === 'Warrior');
        return data.filter(warr);
        function warr(datas){
            console.log(datas.role);
            return datas.role === 'Warrior';
        }
}
function getNameTags(data){
    return data.map((datas) => 
    datas.name = '['+datas.role+'] ' + datas.name);
}
function findGandalf(data) {
    //find 會把data陣列的每個物件丟進去findg函式比對
    return data.find(findg);//findg為true時，會把該物件回傳
    function findg(datas){//datas是obj
        console.log(datas.name);//學長，這裡因為在 getNameTags 裡面改過name的值了
        return datas.name === '[Mage] Gandalf';//所以我這裏找的時候也要改，不然會找不到 Gandalf
    }
}
function calculateTotalMoney(data){
    return data.reduce(calcu,0);//reduce 回傳一個值
    function calcu(total, datas){
        console.log(total,datas.money);
        return total + datas.money;
    }
}
function checkStatus(data) {
    const allReady = data.every(person => person.isReady === true);
    const superStrong = data.some( person => person.level > 100 );

    return {
        isEveryoneReady: allReady,
        hasSuperStrong: superStrong
    };
}
function tallyRoles(data){
    const roles = data.map(datas => datas.role);//取出角色(array)
    console.log(roles);
    return roles.reduce(acc, {});
    function acc(counts, role){
        counts[role] = (counts[role] || 0) + 1;//若為undefin則為0，再加一
        console.log(counts[role]);
        return counts;
    }
}