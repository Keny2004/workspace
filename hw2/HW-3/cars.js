//把以下程式碼複製到cars.js
class Car {
  constructor(brand) {
    this.brand = brand;
  }

  introduce() {
    return "這是一台 " + this.brand;
  }
}

// 以下請自行SportsCar, FamilyVan等等的類別
class SportsCar extends Car {
  constructor(brand, topSpeed) {
    super(brand);
    this.topSpeed = 300;
  }

  introduce() {
    return super.introduce() + this.topSpeed;
  }
}

class FamilyVan extends Car {
  constructor(brand, seatCount) {
    super(brand);
    this.seatCount = 40;
  }

  introduce() {
    return super.introduce() + this.seatCount;
  }
}

class HeavyTruck extends Car {
  constructor(brand, cargoCapacity) {
    super(brand);
    this.cargoCapacity = 5000;
  }

  introduce() {
    return super.introduce() + this.cargoCapacity;
  }
}

