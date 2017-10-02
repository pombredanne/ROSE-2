var ROSE = (function() {
    "use strict";

    function App() {
        this.client = null;
        this.controller = null;
        this.rate = null;
        this.context = null;
        this.dashboard = null;
        this.track = null;
        this.obstacles = null;
    }

    App.prototype.ready = function() {
        this.controller = new Controller();
        this.rate = new Rate([0.5, 1.0, 2.0, 5.0, 10.0]);

        var loader = new ImageLoader(function() {
            this.client = new Client(this.onmessage.bind(this), 2000);
        }.bind(this));

        this.context = $("#game").get(0).getContext("2d");
        this.dashboard = new Dashboard(loader);
        this.track = new Track(loader);
        this.obstacles = new Obstacles(loader);
    }

    App.prototype.onmessage = function(m) {
        var msg = JSON.parse(m.data);
        if (msg.action !== "update") {
            console.log("Ignoring unknown message: " + m.data);
            return;
        }

        var state = msg.payload;

        // Update
        this.controller.update(state.started);
        this.rate.update(state.rate);
        this.dashboard.update(state);
        this.track.update(state);
        this.obstacles.update(state);

        // Draw
        this.dashboard.draw(this.context);
        this.track.draw(this.context);
        this.obstacles.draw(this.context);
    }

    function Client(onmessage, reconnect_msec) {
        this.onmessage = onmessage;
        this.reconnect_msec = reconnect_msec;
        this.socket = null;
        this.connect();
    }

    Client.prototype.connect = function() {
        var wsuri = "ws://" + window.location.hostname + ":8880/ws";
        console.log("Connecting to " + wsuri);
        this.socket = new WebSocket(wsuri);
        this.socket.onopen = function(e) {
            console.log("Connected")
        };
        this.socket.onmessage = this.onmessage;
        this.socket.onclose = this.onclose.bind(this);
    }

    Client.prototype.onclose = function(e) {
        console.log("Disconnected wasClean=" + e.wasClean + ", code=" +
            e.code + ", reason='" + e.reason + "')");
        this.socket = null;
        console.log("Reconnecting in " + this.reconnect_msec + " milliseconds");
        setTimeout(this.connect.bind(this), this.reconnect_msec);
    }

    function Controller() {
        var self = this;
        $("#start").click(function(event) {
            event.preventDefault();
            self.start();
        });

        $("#stop").click(function(event) {
            event.preventDefault();
            self.stop();
        });
    }

    Controller.prototype.start = function() {
        var self = this;
        self.disable();
        $.post("admin", {running: 1})
            .done(function() {
                self.update(true);
            })
            .fail(function(xhr) {
                self.update(false);
                console.log("Error starting: " + xhr.responseText);
            })
    }

    Controller.prototype.stop = function() {
        var self = this;
        self.disable();
        $.post("admin", {running: 0})
            .done(function() {
                self.update(false);
            })
            .fail(function(xhr) {
                self.update(true);
                console.log("Error stopping: " + xhr.responseText);
            })
    }

    Controller.prototype.update = function(running) {
        if (running) {
            $("#start").attr("disabled", "disabled");
            $("#stop").removeAttr("disabled");
        } else {
            $("#start").removeAttr("disabled");
            $("#stop").attr("disabled", "disabled");
        }
    }

    Controller.prototype.disable = function() {
        $("#start").attr("disabled", "disabled");
        $("#stop").attr("disabled", "disabled");
    }

    function Rate(values) {
        this.values = values;
        this.rate = null;
        var self = this;

        $("#dec_rate").click(function(event) {
            event.preventDefault();
            self.decrease();
        });

        $("#cur_rate").click(function(event) {
            event.preventDefault();
            self.post(1);
        });

        $("#inc_rate").click(function(event) {
            event.preventDefault();
            self.increase();
        });
    }

    Rate.prototype.update = function(rate) {
        this.rate = rate;
        $("#cur_rate").text(rate + " FPS");
        this.validate();
    }

    Rate.prototype.validate = function() {
        if (this.rate == this.values[0]) {
            $("#dec_rate").attr("disabled", "disabled")
        } else {
            $("#dec_rate").removeAttr("disabled")
        }
        $("#cur_rate").removeAttr("disabled");
        if (this.rate == this.values[this.values.length-1]) {
            $("#inc_rate").attr("disabled", "disabled")
        } else {
            $("#inc_rate").removeAttr("disabled")
        }
    }

    Rate.prototype.disable = function() {
        $("#rate_ctl button").attr("disabled", "disabled");
    }

    Rate.prototype.decrease = function() {
        var i;
        for (i = this.values.length - 1; i >= 0; i--) {
            if (this.values[i] < this.rate) {
                this.post(this.values[i]);
                break;
            }
        }
    }

    Rate.prototype.increase = function() {
        var i;
        for (i = 0; i < this.values.length; i++) {
            if (this.values[i] > this.rate) {
                this.post(this.values[i]);
                break;
            }
        }
    }

    Rate.prototype.post = function(value) {
        var self = this;
        self.disable();
        $.post("admin", {rate: value})
            .done(function() {
                self.update(value);
            })
            .fail(function(xhr) {
                self.validate();
                console.log("Error changing rate: " + xhr.responseText);
            })
    }

    function Dashboard(loader) {
        this.players = null;
        this.timeleft = null;
        var self = this;
        loader.load("res/dashboard/dashboard.png", function(img) {
            self.texture = img;
        });
    }

    Dashboard.prototype.update = function(state) {
        this.players = state.players;
        this.timeleft = state.timeleft;
    }

    Dashboard.prototype.draw = function(ctx) {
        ctx.drawImage(this.texture, 0, 0);

        var text = this.timeleft.toString()
        if (this.timeleft < 10) {
            text = "0" + text;
        }

        ctx.fillStyle = "rgb(153, 153, 153)";
        ctx.textBaseline = "middle";

        ctx.font = "bold 48px sans-serif";
        ctx.textAlign = "center";

        ctx.fillText(text, this.texture.width / 2, this.texture.height / 2);

        ctx.font = "bold 36px sans-serif";
        ctx.textAlign = "left";

        var i;
        for (i = 0; i < this.players.length; i++) {
            var player = this.players[i];
            var text = player.name + ": " + player.score;
            ctx.fillText(text, 50 + player.lane * 530, this.texture.height / 2);
        }
    }

    function Obstacles(loader) {
        this.track = null;
        this.textures = {};
        var self = this;

        loader.load("res/obstacles/barrier.png", function(img) {
            self.textures["barrier"] = img;
        });
        loader.load("res/obstacles/bike.png", function(img) {
            self.textures["bike"] = img;
        });
        loader.load("res/obstacles/crack.png", function(img) {
            self.textures["crack"] = img;
        });
        loader.load("res/obstacles/penguin.png", function(img) {
            self.textures["penguin"] = img;
        });
        loader.load("res/obstacles/trash.png", function(img) {
            self.textures["trash"] = img;
        });
        loader.load("res/obstacles/water.png", function(img) {
            self.textures["water"] = img;
        });
    }

    Obstacles.prototype.update = function(state) {
        this.track = state.track;
    }

    Obstacles.prototype.draw = function(ctx) {
        //TODO move to constants
        var dashboard_height = 150;
        var left_margin = 95;
        var cell_width = 130;
        var top_margin = 10;
        var row_height = 65;
        var i;
        for (i = 0; i < this.track.length; i++) {
            var obstacle = this.track[i];
            var img = this.textures[obstacle["name"]];
            var x = left_margin + obstacle["x"] * cell_width;
            var y = dashboard_height + top_margin + obstacle["y"] * row_height;
            ctx.drawImage(img, x, y);
        }
    }

    function Track(loader) {
        this.track = null
        this.textures = [null, null, null];
        var self = this;

        loader.load("res/bg/bg_1.png", function(img) {
            self.textures[0] = img;
        });
        loader.load("res/bg/bg_2.png", function(img) {
            self.textures[1] = img;
        });
        loader.load("res/bg/bg_3.png", function(img) {
            self.textures[2] = img;
        });
    }

    Track.prototype.update = function(state) {
        this.track = state.track;
        if (state.started) {
            // Simulate track movement
            var last = this.textures.pop();
            this.textures.unshift(last);
        }
    }

    Track.prototype.draw = function(ctx) {
        var dashboard_height = 150;
        var track_length = 9;
        var i;
        for (i = 0; i < track_length; i++) {
            var img = this.textures[i % this.textures.length];
            ctx.drawImage(img, 0, dashboard_height + (i * img.height));
        }
    }

    function ImageLoader(done) {
        this.loading = 0;
        this.done = done;
    }

    ImageLoader.prototype.load = function(url, done) {
        var img = new Image();
        var self = this;
        self.loading++;
        $(img).on("load", function() {
            done(img);
            self.loading--;
            if (self.loading == 0) {
                self.done();
            }
        });
        img.src = url;
    }

    return new App();
}());