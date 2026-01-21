//把以下程式碼複製到linked_list.js，並實作append(value), toString(), removeLast()函式
class Node {
  constructor(value) {
    this.value = value; // 乘客 (靈魂)
    this.next = null;   // 靈魂鎖鏈 (指向下一節)
  }
}
class LinkedList {
  constructor() {
    this.head = null; // 列車長 (車頭)
  }
  
  append(value) {    // 任務一：有新乘客上車 (掛在車尾)
    const newNode = new Node(value);
    if (!this.head) {
      this.head = newNode;
      return;
    }
    let current = this.head;
    while (current.next) {
      current = current.next;
    }
    current.next = newNode;
  }
  toString() {       // 任務二：點名 (列出所有乘客)
    let result = "";
    let current = this.head;
    while (current) {
      result += current.value + " ";
      current = current.next;
    }
    return result.trim();
  }
  removeLast() {     // 任務三：最後一位乘客下車
    if (!this.head) return null;
    if (!this.head.next) {
      const value = this.head.value;
      this.head = null;
      return value;
    }
    let current = this.head;
    while (current.next && current.next.next) {
      current = current.next;
    }
    const value = current.next.value;
    current.next = null;
    return value;
  }
}