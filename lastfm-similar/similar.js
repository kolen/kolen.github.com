/* Create a cache object */
var cache = new LastFMCache();

/* Create a LastFM object */
var lastfm = new LastFM({
    apiKey    : 'b64aac69ec50fe99a2550b53c70a175b',
    apiSecret : '75251d24696c1dd6b7db7a5d6af760af',
    cache     : cache
});

var all_library_artists = {
    user: null,
    artists: null
}

var SimilarViewModel = function() {
    this.isRunning = ko.observable(false)
    this.username = ko.observable(localStorage.user ? localStorage.user : "")
    this.artist = ko.observable("")

    this.consoleText = ko.observable("Ready\n")
    this.artistsInLibrary = ko.observable(0)
    this.resultArtists = ko.observableArray()
    this.similarArtistsReturned = ko.observable(0)
    this.similarArtistsAfterFilter = ko.observable(0)

    this.run = function() {
        this.isRunning(true)
        this.resultArtists.removeAll()
        console.log("run")
        if (localStorage.user != this.username()) {
            this.getAllLibraryArtists(this.username(), function(artists) {
                var artists_ = {__length: 0}
                artists.forEach(function(a){artists_[a.name]=true; artists_.__length++})
                localStorage.user = this.username()
                localStorage.artists = JSON.stringify(artists_)
                this.generateResults(artists_, this.artist())
            })
        } else {
            var artists = JSON.parse(localStorage.artists)
            this.console("Got library from cache")
            this.artistsInLibrary(artists.__length)
            this.generateResults(artists, this.artist())
        }
    }

    this.generateResults = function(library, artist) {
        s = this
        lastfm.artist.getSimilar({artist:artist, autocorrect:1}, {
            success: function(data) {
                var filtered_artists = data.similarartists.artist.filter(function(a){console.log(a);return !library[a.name]})
                console.log(filtered_artists)
                filtered_artists.forEach(function(a){s.resultArtists.push(a)})

                s.similarArtistsReturned(data.similarartists.artist.length)
                s.similarArtistsAfterFilter(filtered_artists.length)

                s.isRunning(false)
            },
            error: function(error, message) {
                s.console("Error: "+message)
                s.isRunning(false)
            }
        })
    }

    this.console = function(text) {
        this.consoleText(this.consoleText() + text + "\n")
    }

    this.consoleClear = function(text) {
        this.consoleText("")
    }

    this.getAllLibraryArtists = function(username, callback) {
        var artists = []
        var total_pages = null
        var current_page = 1
        var page_size = 100
        var delay = 1000

        s = this
        var getNext = function() {
            s.console("Getting libary for "+username+", page "+current_page+" / "+(total_pages ? total_pages : "unknown"))
            lastfm.library.getArtists({user: username, page: current_page, limit: page_size}, {
                success: function(data) {
                    console.log(data)
                    if (data && data.artists && data.artists.artist) {
                        var new_artists = data.artists.artist
                        console.log("... got ", new_artists.length)
                    
                        s.artistsInLibrary(data.artists['@attr'].total)
                        if (total_pages === null) {
                            total_pages = data.artists['@attr'].totalPages
                        }

                        artists = artists.concat(new_artists)
                    }

                    if (current_page < total_pages) {
                        current_page++
                        setTimeout(function(){getNext.call(s)}, delay)
                    } else {
                        callback.call(s, artists)
                    }
                },
                error: function(error, message) {
                    s.console("Error: "+message)
                    s.isRunning(false)
                }
            })
        }
        getNext()
    }
}


console.log("applyBindings")
ko.applyBindings(new SimilarViewModel())

