'use strict';
;(function() {
	// game event flags
	let startGame = false;
	let isHandlerPlacement = false;
	let isHandlerController = false;
	let compShot = false;

	const getElement = id => document.getElementById(id);
	// calculating the coordinates of all sides of the element relative to the browser window
	const getCoordinates = el => {
		const coords = el.getBoundingClientRect();
		return {
			left: coords.left + window.pageXOffset,
			right: coords.right + window.pageXOffset,
			top: coords.top + window.pageYOffset,
			bottom: coords.bottom + window.pageYOffset
		};
	};

	const humanfield = getElement('field_human');
	const computerfield = getElement('field_computer');

	class Field {
		// random ship placement and basic game data
	
		static FIELD_SIDE = 330;
		static SHIP_SIDE = 33;
		static SHIP_DATA = {
			fourdeck: [1, 4],
			tripledeck: [2, 3],
			doubledeck: [3, 2],
			singledeck: [4, 1]
		};

		constructor(field) {
			this.field = field;
			// data for each created ship
			this.squadron = {};
			// two-dimensional array in which the coordinates of the ships are entered
			this.matrix = [];
			// coordinates of all four sides of the playing field frame
			let { left, right, top, bottom } = getCoordinates(this.field);
			this.fieldLeft = left;
			this.fieldRight = right;
			this.fieldTop = top;
			this.fieldBottom = bottom;
		}

		static createMatrix() {
			return [...Array(10)].map(() => Array(10).fill(0));
		}

		static getRandom = n => Math.floor(Math.random() * (n + 1));

		cleanField() {
			while (this.field.firstChild) {
				this.field.removeChild(this.field.firstChild);
			}
			this.squadron = {};
			this.matrix = Field.createMatrix();
		}

		randomLocationShips() {
			for (let type in Field.SHIP_DATA) {
				let count = Field.SHIP_DATA[type][0];
				let decks = Field.SHIP_DATA[type][1];
				for (let i = 0; i < count; i++) {
					let options = this.getCoordsDecks(decks);
					options.decks = decks;
					options.shipname = type + String(i + 1);
					const ship = new Ships(this, options);
					ship.createShip();
				}
			}
		}

		getCoordsDecks(decks) {
			// coefficients that determine the direction of the ship's location
			let kx = Field.getRandom(1), ky = (kx == 0) ? 1 : 0,
				x, y;

			// initial coordinates for ship
			if (kx == 0) {
				x = Field.getRandom(9); y = Field.getRandom(10 - decks);
			} else {
				x = Field.getRandom(10 - decks); y = Field.getRandom(9);
			}

			const obj = {x, y, kx, ky}
			const result = this.checkLocationShip(obj, decks);
			if (!result) return this.getCoordsDecks(decks);
			return obj;
		}

		checkLocationShip(obj, decks) {
			let { x, y, kx, ky, fromX, toX, fromY, toY } = obj;
			fromX = (x == 0) ? x : x - 1;
			if (x + kx * decks == 10 && kx == 1) toX = x + kx * decks;
			else if (x + kx * decks < 10 && kx == 1) toX = x + kx * decks + 1;
			else if (x == 9 && kx == 0) toX = x + 1;
			else if (x < 9 && kx == 0) toX = x + 2;

			fromY = (y == 0) ? y : y - 1;
			if (y + ky * decks == 10 && ky == 1) toY = y + ky * decks;
			else if (y + ky * decks < 10 && ky == 1) toY = y + ky * decks + 1;
			else if (y == 9 && ky == 0) toY = y + 1;
			else if (y < 9 && ky == 0) toY = y + 2;

			if (toX === undefined || toY === undefined) return false;

			if (this.matrix.slice(fromX, toX)
				.filter(arr => arr.slice(fromY, toY).includes(1))
				.length > 0) return false;
			return true;
		}
	}


	class Ships {
		// all ship info
		constructor(self, { x, y, kx, ky, decks, shipname }) {
			this.player = (self === human) ? human : computer;
			// field this ship is created on
			this.field = self.field;
			// unique ship name
			this.shipname = shipname;
			// number of decks
			this.decks = decks;
			// X coordinate of the first deck
			this.x = x;
		 	// Y coordinate of the first deck
			this.y = y;
			// direction of the decks
			this.kx = kx;
			this.ky = ky;
			// hit counter
			this.hits = 0;
			// array with all ship deck coordinates
			this.arrDecks = [];
		}

		static showShip(self, shipname, x, y, kx) {
			// creating a new element with the specified tag
			const div = document.createElement('div');
			const classname = shipname.slice(0, -1);
			const dir = (kx == 1) ? ' vertical' : '';
			// setting a unique identifier for the ship
			div.setAttribute('id', shipname);
			// collecting all classes in one line
			div.className = `ship ${classname}${dir}`;
			// setting the position of the ship through the 'style' attribute
			div.style.cssText = `left:${y * Field.SHIP_SIDE}px; top:${x * Field.SHIP_SIDE}px;`;
			self.field.appendChild(div);
		}

		createShip() {
			let { player, field, shipname, decks, x, y, kx, ky, hits, arrDecks, k = 0 } = this;

			while (k < decks) {
				let i = x + k * kx, j = y + k * ky;
				// filling the matrix
				/*
				matrix symbols:
				0 - empty space
				1 - ship deck
				2 - cell next to the sank ship
				3 - miss cell
				4 - hit cell
				*/
				player.matrix[i][j] = 1;
				arrDecks.push([i, j]);
				k++;
			}

			player.squadron[shipname] = {arrDecks, hits, x, y, kx, ky};
			if (player === human) {
				Ships.showShip(human, shipname, x, y, kx);
				if (Object.keys(player.squadron).length == 10) {
					buttonPlay.hidden = false;
				}
			}
		}
	}


	class Placement {
		// this class is used to allow player create their own ship placements

		// object with coordinates of the playing field sides
		static FRAME_COORDS = getCoordinates(humanfield);
		
		constructor() {
			this.dragObject = {};
			// left mouse button flag
			this.pressed = false;
		}

		static getShipName = el => el.getAttribute('id');
		static getCloneDecks = el => {
			const type = Placement.getShipName(el).slice(0, -1);
			return Field.SHIP_DATA[type][1];
		}

		setObserver() {
			if (isHandlerPlacement) return;
			document.addEventListener('mousedown', this.onMouseDown.bind(this));
			document.addEventListener('mousemove', this.onMouseMove.bind(this));
			document.addEventListener('mouseup', this.onMouseUp.bind(this));
			humanfield.addEventListener('contextmenu', this.rotationShip.bind(this));
			isHandlerPlacement = true;
		}

		onMouseDown(e) {
			if (e.which != 1 || startGame) return;

			const el = e.target.closest('.ship');
			if(!el) return;

			this.pressed = true;

			// portable object and its properties
			this.dragObject = {
				el,
				parent: el.parentElement,
				next: el.nextElementSibling,
				// coordinates from which the transfer started
				downX: e.pageX,
				downY: e.pageY,
				left: el.offsetLeft,
				top: el.offsetTop,
				kx: 0,
				ky: 1
			};
			if (el.parentElement === humanfield) {
				const name = Placement.getShipName(el);
				this.dragObject.kx = human.squadron[name].kx;
				this.dragObject.ky = human.squadron[name].ky;
			}
		}

		onMouseMove(e) {
			if (!this.pressed || !this.dragObject.el) return;

			// getting the coordinates of the sides of the ship clone
			let { left, right, top, bottom } = getCoordinates(this.dragObject.el);

			// creating new ship clone
			if (!this.clone) {
				this.decks = Placement.getCloneDecks(this.dragObject.el);
				this.clone = this.creatClone({left, right, top, bottom}) || null;
				if (!this.clone) return;

				this.shiftX = this.dragObject.downX - left;
				this.shiftY = this.dragObject.downY - top;
				this.clone.style.zIndex = '1000';
				document.body.appendChild(this.clone);

				// remove the obsolete ship if it exists
				this.removeShipFromSquadron(this.clone);
			}

			// clone coordinates relative to BODY, taking into account cursor shift
			let currentLeft = Math.round(e.pageX - this.shiftX),
				currentTop = Math.round(e.pageY - this.shiftY);
			this.clone.style.left = `${currentLeft}px`;
			this.clone.style.top = `${currentTop}px`;

			// check that the clone is within the playing field
			if (
			left >= Placement.FRAME_COORDS.left - 14 &&
			right <= Placement.FRAME_COORDS.right + 14 && 
			top >= Placement.FRAME_COORDS.top - 14 && 
			bottom <= Placement.FRAME_COORDS.bottom + 14
			) {
				this.clone.classList.remove('unsuccess');
				this.clone.classList.add('success');

				const { x, y } = this.getCoordsCloneInMatrix({ left, right, top, bottom });
				const obj = {
					x,
					y,
					kx: this.dragObject.kx,
					ky: this.dragObject.ky
				};

				const result = human.checkLocationShip(obj, this.decks);
				if (!result) {
					this.clone.classList.remove('success');
					this.clone.classList.add('unsuccess');
				}
			} else {
				this.clone.classList.remove('success');
				this.clone.classList.add('unsuccess');
			}
		}

		onMouseUp(e) {
			this.pressed = false;
			if (!this.clone) return;

			// if the clone coordinates are invalid, 
			//return it to the place where the transfer was started from
			if (this.clone.classList.contains('unsuccess')) {
				this.clone.classList.remove('unsuccess');
				this.clone.rollback();
			} else {
				this.createShipAfterMoving();
			}
			this.removeClone();
		}

		rotationShip(e) {
			e.preventDefault();
			if (e.which != 3 || startGame) return;

			const el = e.target.closest('.ship');
			const name = Placement.getShipName(el);

			if (human.squadron[name].decks == 1) return;

			const obj = {
				kx: (human.squadron[name].kx == 0) ? 1 : 0,
				ky: (human.squadron[name].ky == 0) ? 1 : 0,
				x: human.squadron[name].x,
				y: human.squadron[name].y
			};

			const decks = human.squadron[name].arrDecks.length;
			this.removeShipFromSquadron(el);
			human.field.removeChild(el);

			// check the validity of the coordinates after the rotation
			const result = human.checkLocationShip(obj, decks);
			if(!result) {
				obj.kx = (obj.kx == 0) ? 1 : 0;
				obj.ky = (obj.ky == 0) ? 1 : 0;
			}

			obj.shipname = name;
			obj.decks = decks;
			const ship = new Ships(human, obj);
			ship.createShip();

			if (!result) {
				const el = getElement(name);
				el.classList.add('unsuccess');
				setTimeout(() => { el.classList.remove('unsuccess') }, 750);
			}
		}

		creatClone() {
			const clone = this.dragObject.el;
			const oldPosition = this.dragObject;

			clone.rollback = () => {
				if (oldPosition.parent == humanfield) {
					clone.style.left = `${oldPosition.left}px`;
					clone.style.top = `${oldPosition.top}px`;
					clone.style.zIndex = '';
					oldPosition.parent.insertBefore(clone, oldPosition.next);
					this.createShipAfterMoving();
				} else {
					clone.removeAttribute('style');
					oldPosition.parent.insertBefore(clone, oldPosition.next);
				}
			};
			return clone;
		}

		removeClone() {
			delete this.clone;
			this.dragObject = {};
		}

		createShipAfterMoving() {
			// getting the coordinates recalculated relative to the playing field
			const coords = getCoordinates(this.clone);
			let { left, top, x, y } = this.getCoordsCloneInMatrix(coords);
			this.clone.style.left = `${left}px`;
			this.clone.style.top = `${top}px`;

			humanfield.appendChild(this.clone);
			this.clone.classList.remove('success');

			const options = {
				shipname: Placement.getShipName(this.clone),
				x,
				y,
				kx: this.dragObject.kx,
				ky: this.dragObject.ky,
				decks: this.decks
			};

			// creating a new ship
			const ship = new Ships(human, options);
			ship.createShip();
			// now the ship itself is in the playing field, so we delete its clone
			humanfield.removeChild(this.clone);
		}

		getCoordsCloneInMatrix({left, right, top, bottom} = coords) {
			let computedLeft = left - Placement.FRAME_COORDS.left,
				computedRight = right - Placement.FRAME_COORDS.left,
				computedTop = top - Placement.FRAME_COORDS.top,
				computedBottom = bottom - Placement.FRAME_COORDS.top;

			const obj = {};

			// removing inaccuracies in the positioning of the clone
			let ft = (computedTop < 0) ? 0 : (computedBottom > Field.FIELD_SIDE) ? Field.FIELD_SIDE - Field.SHIP_SIDE : computedTop;
			let fl = (computedLeft < 0) ? 0 : (computedRight > Field.FIELD_SIDE) ? Field.FIELD_SIDE - Field.SHIP_SIDE * this.decks : computedLeft;

			obj.top = Math.round(ft / Field.SHIP_SIDE) * Field.SHIP_SIDE;
			obj.left = Math.round(fl / Field.SHIP_SIDE) * Field.SHIP_SIDE;
			// value in matrix coordinates
			obj.x = obj.top / Field.SHIP_SIDE;
			obj.y = obj.left / Field.SHIP_SIDE;

			return obj;
		}

		removeShipFromSquadron(el) {
			const name = Placement.getShipName(el);
			if (!human.squadron[name]) return;
			const arr = human.squadron[name].arrDecks;
			for (let coords of arr) {
				const [x, y] = coords;
				human.matrix[x][y] = 0;
			}
			// removing all information about the ship from the squadron array
			delete human.squadron[name];
		}
	}


	class Controller {
		// all game mechanics

		static SERVICE_TEXT = getElement('service_text');

		constructor() {
			this.player = '';
			this.opponent = '';
			this.text = '';
			// array with the coordinates of the shots for selection
			this.coordsFreeHit = [];
			// array with coordinates around the hit cell
			this.coordsAroundHit = [];

			this.num = [4, 3, 2, 1];
			this.result = Array(100);
			this.aimout;
			this.currtime = Date.now();
			this.resetTempShip();
		}

		static showServiceText = text => {
			Controller.SERVICE_TEXT.innerHTML = text;
		}

		// conversion of absolute coordinates of icons to matrix coordinates
		static getCoordsIcon = el => {
			const x = el.style.top.slice(0, -2) / Field.SHIP_SIDE;
			const y = el.style.left.slice(0, -2) / Field.SHIP_SIDE;
			return [x, y];
		}

		static removeElementArray = (arr, [x, y]) => {
			return arr.filter(item => item[0] != x || item[1] != y);
		}

		init() {
			// randomly choose who moves first
			const random = Field.getRandom(1);
			this.player = (random == 0) ? human : computer;
			this.opponent = (this.player === human) ? computer : human;

			this.setCoordsShot();

			if (!isHandlerController) {				
				// player shot
				computerfield.addEventListener('click', this.makeShot.bind(this));
				isHandlerController = true;
			}

			if (this.player === human) {
				compShot = false;
				this.text = 'You go first';
			} else {
				compShot = true;
				this.text = 'Computer goes first';
				// computer shot
				setTimeout(() => this.makeShot(), 2000);
			}
			Controller.showServiceText(this.text);
		}

		setCoordsShot() {
			for (let i = 0; i < 10; i++) {
				for(let j = 0; j < 10; j++) { this.coordsFreeHit.push([i, j]); }
			}
		}

		setCoordsAroundHit(x, y, coords) {
			let {firstHit, kx, ky} = this.tempShip;
			if (firstHit.length == 0) {
				this.tempShip.firstHit = [x, y];
			} else if (kx == 0 && ky == 0) {
				this.tempShip.kx = (Math.abs(firstHit[0] - x) == 1) ? 1 : 0;
				this.tempShip.ky = (Math.abs(firstHit[1] - y) == 1) ? 1 : 0;
			}

			for (let coord of coords) {
				x = coord[0]; y = coord[1];
				if (x < 0 || x > 9 || y < 0 || y > 9) continue;
				if (human.matrix[x][y] != 0 && human.matrix[x][y] != 1) continue;
				this.coordsAroundHit.push([x, y]);
			}
		}

		removeShip() {
			this.markUselessCellAroundShip();
			this.coordsAroundHit = [];
			this.resetTempShip();
		}

		checkUselessCell(coords) {
			if (computer.matrix[coords[0]][coords[1]] > 1) return false;
			return true;
		}

		// setting markers around the ship on hit
		markUselessCell(coords) {
			let x, y;
			for (let coord of coords) {
				x = coord[0]; y = coord[1];
				if (x < 0 || x > 9 || y < 0 || y > 9) continue;
				if (this.opponent.matrix[x][y] == 2 || this.opponent.matrix[x][y] == 3) continue;
				this.opponent.matrix[x][y] = 2;
				setTimeout(() => this.showIcons(this.opponent, coord, 'shaded-cell'), 200);
				if (this.opponent === human) {
					this.removeCoordsFromArrays(coord);
				}
			}
		}

		transformCoordsInMatrix(e, self) {
			const x = Math.trunc((e.pageY - self.fieldTop) / Field.SHIP_SIDE);
			const y = Math.trunc((e.pageX - self.fieldLeft) / Field.SHIP_SIDE);
			return [x, y];
		}

		removeCoordsFromArrays(coords) {
			if (this.coordsAroundHit.length > 0) {
				this.coordsAroundHit = Controller.removeElementArray(this.coordsAroundHit, coords);
			}
			this.coordsFreeHit = Controller.removeElementArray(this.coordsFreeHit, coords);
		}

		// setting markers after the destruction of the ship
		markUselessCellAroundShip() {
			const {hits, kx, ky, x0, y0} = this.tempShip;
			let coords;

			if (this.tempShip.hits == 1) {
				coords = [
					[x0 - 1, y0],
					[x0 + 1, y0],
					[x0, y0 - 1],
					[x0, y0 + 1]
				];
			} else {
				coords = [
					[x0 - kx, y0 - ky],
					[x0 + kx * hits, y0 + ky * hits]
				];
			}
			this.markUselessCell(coords);
		}

		showIcons(opponent, [x, y], iconClass) {
			const field = opponent.field;
			if (iconClass === 'dot' || iconClass === 'red-cross') {
				setTimeout(() => fn(), 400);
			} else {
				fn();
			}
			function fn() {
				const span = document.createElement('span');
				span.className = `icon-field ${iconClass}`;
				span.style.cssText = `left:${y * Field.SHIP_SIDE}px; top:${x * Field.SHIP_SIDE}px;`;
				// placing an icon on the playing field
				field.appendChild(span);
			}
		}

		showExplosion(x, y) {
			this.showIcons(this.opponent, [x, y], 'explosion');
			const explosion = this.opponent.field.querySelector('.explosion');
			explosion.classList.add('active');
			setTimeout(() => explosion.remove(), 230);
		}

		getCoordsForShot() {
			if (this.coordsAroundHit.length > 0) {
				this.coordsAroundHit = this.sortCoordsAroundHit(this.coordsAroundHit);
				const coords = this.coordsAroundHit.pop();
				this.removeCoordsFromArrays(coords);
				return coords;
			} else {
				this.result.fill(0);
				let ayin = 0;
				const accuracy = 200;
				let error = 3;
				let stime = Date.now();
				while (ayin < accuracy) {
					let aim = [];
					this.aimout = [];
					this.generation(this.coordsFreeHit, this.num, aim, error);
					if (this.aimout.length > 0) {
						ayin++;
						for (let [i, j] of this.aimout) { 
							this.result[i * 10 + j]++;
						}
					}
					let etime = Date.now();
					if (etime - stime > 1000 && Math.max(...this.result) > 2) {break;}
					if (etime - stime > 1000 && Math.max(...this.result) <= 2) {
						stime = Date.now();
						error += 5;
					}
				}
				let ij = this.result.indexOf(Math.max(...this.result));
				const coords = [parseInt(ij / 10), ij % 10];
				this.removeCoordsFromArrays(coords);
				return coords;
			}		
		}

		generation(space, types, aim, error) {
			// generates ships in empty spots to find a place with
			//highest probability of having a ship
			for (let err = 0; err < error; err++) {
				let [i, j] = space[Math.floor(Math.random() * space.length)];
				let di = [0, 1][Math.floor(Math.random() * 2)];
				let dj = 1 - di;
				let temp;
				if (types[3] == 1) temp = 7;
				else if (types[2] > 0) temp = 8;
				else if (types[1] > 0) temp = 9;
				else if (types[0] > 0) temp = 10;
				if (
				(i < temp || dj == 1) &&
				(j < temp || di == 1) &&
				(temp > 9 || this.includeSpace(space, i + di, j + dj) > -1) &&	
				(temp > 8 || this.includeSpace(space, i + 2 * di, j + 2 * dj)) > -1 &&	
				(temp > 7 || this.includeSpace(space, i + 3 * di, j + 3 * dj)) > -1
				) {
					this.actionsInGeneration(space.slice(0), types.slice(0), aim.slice(0), temp, di, dj, i, j, error); 
				}
				if (this.aimout.length > 0) { return; }
			}
		}

		actionsInGeneration(space, types, aim, temp, di, dj, i, j, error) {
			aim.push([i, j]);
			if (temp < 10) aim.push([i + di, j + dj]);
			if (temp < 9) aim.push([i + 2 * di, j + 2 * dj]);
			if (temp == 7) aim.push([i + 3 * di, j + 3 * dj]);
			for (let y = 0; y < 11 - temp; y++) {
				space = this.potentialRemove(space, i + y * di, j + y * dj);
			}
			types[10 - temp]--;
			if (types.every(value => value == 0)) {
				this.aimout = aim.slice(0);
				return;
			} else if (space.length > 0) {
				this.generation(space.slice(0), types.slice(0), aim.slice(0), error);
			}
		}

		potentialRemove(space, i, j) {
			for (let k of [
				[i + 1, j - 1], [i + 1, j], [i, j + 1], 
				[i + 1, j + 1], [i - 1, j], [i, j - 1],
				[i - 1, j - 1], [i - 1, j + 1], [i, j]
			]) {
				space = this.removeItemOnce(space, k);
			}
			return space;
		}

		includeSpace(space, i, j) {
			let index = 0;
			for (let dot of space) {
				if (dot[0] == i && dot[1] == j) return index;
				index++;
			}
			return -1;
		}

		removeItemOnce(arr, [i, j]) {
			let index = this.includeSpace(arr, i, j);
			if (index > -1) { arr.splice(index, 1); }
			return arr;
		}

		resetTempShip() {
			this.tempShip = {
				hits: 0,
				firstHit: [],
				kx: 0,
				ky: 0
			};
		}

		sortCoordsAroundHit(coords) {
			let valuearr = [];
			for (let [x, y] of coords) {
				valuearr.push(this.result[x*10 + y])
			}
			valuearr.sort();
			let sortedcoord = [];
			for (let m of valuearr) {
				for (let k = 0; k < 100; k++) {
					if (
					this.result[k] == m && 
					this.includeSpace(coords, parseInt(k / 10), k % 10) > -1 && 
					this.includeSpace(sortedcoord, parseInt(k / 10), k % 10) == -1
					) {
						sortedcoord.push([parseInt(k / 10), k % 10]);
					}
				}
			}
			return sortedcoord;
		}

		makeShot(e) {
			let x, y;
			// if the event exists, then the shot was made by the player
			if (e !== undefined) {
				let nowtime = Date.now();
				if (nowtime - this.currtime <= 1000) {return;}
				else {this.currtime = Date.now();}
				if (e.which != 1 || compShot) return;
				if (buttonNewGame.hidden === false) return;
				([x, y] = this.transformCoordsInMatrix(e, this.opponent));
				const check = this.checkUselessCell([x, y]);
				if (!check) return;
			} else {
				// getting the coordinates for the computer shot
				([x, y] = this.getCoordsForShot());
			}

			// show and remove shot icon
			this.showExplosion(x, y);

			const v	= this.opponent.matrix[x][y];
			switch(v) {
				case 0:
					this.miss(x, y);
					break;
				case 1:
					this.hit(x, y);
					break;
				case 3:
					Controller.showServiceText('There is no point in shooting that cell');
					break;
				case 4:
					Controller.showServiceText('There is no point in shooting that cell');
					break;
			}
		}

		miss(x, y) {
			let text = '';
			// setting the miss icon and write the miss to the matrix
			this.showIcons(this.opponent, [x, y], 'dot');
			this.opponent.matrix[x][y] = 3;

			if (this.player === human) {
				text = 'MISS! Computer turn';
				this.player = computer;
				this.opponent = human;
				compShot = true;
				setTimeout(() => this.makeShot(), 2000);
			} else {
				text = 'MISS! Your turn';
				this.player = human;
				this.opponent = computer;
				compShot = false;
			}
			setTimeout(() => Controller.showServiceText(text), 400);
		}

		hit(x, y) {
			let text = '';
			let rem = 0;
			outerloop:
			for (let name in this.opponent.squadron) {
				const dataShip = this.opponent.squadron[name];
				for (let value of dataShip.arrDecks) {
					if (value[0] != x || value[1] != y) continue;
					dataShip.hits++;
					// setting the hit icon and write the hit to the matrix
					this.showIcons(this.opponent, [x, y], 'red-cross');
					this.opponent.matrix[x][y] = 4;
					if (dataShip.hits < dataShip.arrDecks.length) {
						text = (this.player === human) ? 'HIT! Your turn' : 'HIT! Computer turn';
						setTimeout(() => Controller.showServiceText(text), 400);
						break outerloop;
					} else {
						text = (this.player === human) ? 'SUNK! Your turn' : 'SUNK! Computer turn';
						setTimeout(() => Controller.showServiceText(text), 400);
					}
					if (this.opponent === human) {
						rem = 1;
						this.tempShip.x0 = dataShip.x;
					    this.tempShip.y0 = dataShip.y;
						let nam = name.slice(0, -1);
						if (nam == "fourdeck") {this.num[3]--;}
						if (nam == "tripledeck") {this.num[2]--;}
						if (nam == "doubledeck") {this.num[1]--;}
						if (nam == "singledeck") {this.num[0]--;}
					} else {
						let coords;
						if (dataShip.hits == 1) {
							coords = [
								[dataShip.x - 1, dataShip.y],
								[dataShip.x + 1, dataShip.y],
								[dataShip.x, dataShip.y - 1],
								[dataShip.x, dataShip.y + 1]
							];
						} else {
							coords = [
								[dataShip.x - dataShip.kx, dataShip.y - dataShip.ky],
								[dataShip.x + dataShip.kx * dataShip.hits, dataShip.y + dataShip.ky * dataShip.hits]
							];
						}
						this.markUselessCell(coords);
					}
					delete this.opponent.squadron[name];
					break outerloop;
				}
			}

			// all ships of the squadron are destroyed
			if (Object.keys(this.opponent.squadron).length == 0) {
				if (this.opponent === human) {
					text = 'Computer wins';
					for (let name in computer.squadron) {
						const dataShip = computer.squadron[name];
						Ships.showShip(computer, name, dataShip.x, dataShip.y, dataShip.kx );
					}
				} else {
					text = 'Congratulations, you win!';
				}
				Controller.showServiceText(text);
				buttonNewGame.hidden = false;
			// battle continues
			} else {
				let coords;
				// marking diagonal cells 
				coords = [
					[x - 1, y - 1],
					[x - 1, y + 1],
					[x + 1, y - 1],
					[x + 1, y + 1]
				];
				this.markUselessCell(coords);
				if (this.opponent === human) {
                	this.tempShip.hits++;
					// forming the coordinates of the shelling around the hit
					coords = [
						[x - 1, y],
						[x + 1, y],
						[x, y - 1],
						[x, y + 1]
					];
					this.setCoordsAroundHit(x, y, coords);
					if (rem == 1) {this.removeShip()}
					// after a short delay, the computer takes another shot
					setTimeout(() => this.makeShot(), 2000);
				}
			}
		}
	}


	// game data containers
	const instruction = getElement('instruction');
	const shipsCollection = getElement('ships_collection');
	const initialShips = document.querySelector('.wrap + .initial-ships');
	const toptext = getElement('text_top');

	const buttonPlay = getElement('play');
	const buttonNewGame = getElement('newgame');

	const human = new Field(humanfield);
	let computer = {};
	let control = null;

	getElement('type_placement').addEventListener('click', function(e) {
		if (e.target.tagName != 'SPAN') return;

		buttonPlay.hidden = true;
		// clearing the player's playing field before re-arranging the ships
		human.cleanField();
		let initialShipsClone = '';

		const type = e.target.dataset.target;

		const typeGeneration = {
			random() {
				shipsCollection.hidden = true;
				human.randomLocationShips();
			},
			manually() {
				let value = !shipsCollection.hidden;

				if (shipsCollection.children.length > 1) {
					shipsCollection.removeChild(shipsCollection.lastChild);
				}
				if (!value) {
					initialShipsClone = initialShips.cloneNode(true);
					shipsCollection.appendChild(initialShipsClone);
					initialShipsClone.hidden = false;
				}
				shipsCollection.hidden = value;
			}
		};

		typeGeneration[type]();
		const placement = new Placement();
		placement.setObserver();
	});

	buttonPlay.addEventListener('click', function(e) {
		// hiding elements that are not needed for the game
		buttonPlay.hidden = true;
		instruction.hidden = true;

		computerfield.parentElement.hidden = false;
		toptext.innerHTML = 'SEA BATTLE';

		computer = new Field(computerfield);
		computer.cleanField();
		computer.randomLocationShips();

		//initiate the game
		startGame = true;
		if (!control) control = new Controller();
		control.init();
	});

	buttonNewGame.addEventListener('click', function(e) {
		buttonNewGame.hidden = true;
		computerfield.parentElement.hidden = true;
		instruction.hidden = false;
		human.cleanField();
		toptext.innerHTML = 'Ship placement';
		Controller.SERVICE_TEXT.innerHTML = '';

		startGame = false;
		compShot = false;

		control.coordsFreeHit = [];
		control.coordsAroundHit = [];
		control.num = [4, 3, 2, 1];
		control.resetTempShip();
	});


	function printMatrix() {
		let print = '';
		for (let x = 0; x < 10; x++) {
			for (let y = 0; y < 10; y++) {
				print += human.matrix[x][y];
			}
			print += '<br>';
		}
		getElement('matrix').innerHTML = print;
	}
})();
