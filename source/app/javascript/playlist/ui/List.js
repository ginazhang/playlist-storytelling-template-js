define([
	"dojo/has",
	"dojo/_base/lang",
	"dojo/_base/array",
	"dojo/_base/kernel",
	"dojo/promise/all",
	"dojo/Deferred",
	"esri/tasks/QueryTask",
	"esri/tasks/query",
	"lib/jquery-ui",
	"lib/jquery.autoellipsis-1.0.10.min",
	"lib/jquery-ui.min"
	], 
	function(
		has,
		lang,
		array,
		kernel,
		all,
		Deferred,
		QueryTask,
		Query
		){
	/**
	* Playlist List
	* @class Playlist List
	* 
	* Class to define a new item list in the playlist app
	*
	* Dependencies: Jquery 1.10.2
	*/

	return function List(selector,searchSelector,filterSelector,dataFields,onLoad,onGetTitleField,onSelect,onHighlight,onRemoveHightlight,onSearch, filterplaylistItems)
	{
		var _listEl = $(selector),
		_filterSet = [],
		_searchResults,
		_searchType = "attribute",
		layersIdsToCheckforIntersect = configOptions.projectLayerIds;
		
		addSearchEvents();
		
		this.setSearchType = function (searchType) {
			//Sets _searchType
			_searchType = searchType;			
		};

		this.update = function(lyrItems)
		{
			_listEl.empty();
			$(".playlist-item").unbind("click");
			buildList(lyrItems);

			onLoad();
		};

		this.highlight = function(item)
		{
			$(".playlist-item[layer-id=" + item.layerId + "][object-id=" + item.objectId + "]").addClass("highlight");
		};

		this.removeHighlight = function()
		{
			$(".playlist-item").removeClass("highlight");
		};

		this.select = function(item)
		{
			var element = $(".playlist-item[layer-id=" + item.layerId + "][object-id=" + item.objectId + "]");
			if (element.length > 0){
				var itemTop = element.position().top;
				$(".playlist-element").removeClass("selected");
				element.addClass("selected");

				if (itemTop < 0){
					$(selector).scrollTop($(selector).scrollTop() + itemTop);
				}
				else if (itemTop + element.height() > $(selector).height()){
					$(selector).scrollTop($(selector).scrollTop() + itemTop - $(selector).height() + element.height());
				}
			}
		};

		this.removeSelection = function()
		{
			$(".playlist-item").removeClass("selected");
		};

		
		function addSearchEvents()
		{
			if (searchSelector && _searchType){
				$(searchSelector).autocomplete({
					delay:2000,
					source: function(request){
						var result;
						//Determine search type based off of _searchType and search accordingly
						if(_searchType =="attribute") {
						//Handle Project Name Search
						var titles = [];
						var map = kernel.global.map;
						array.forEach(configOptions.projectLayerIds, function(id) {
							//Cycle through all available graphics
							//	Note: should be filtered based on time if layer is time aware
							var layer = map.getLayer(id);
							if(layer) {
								array.forEach(layer.graphics, function(graphic) {
									var title = graphic.attributes[configOptions.dataFields.nameField];
									titles.push(title);
								});
							}
						});
						$(".playlist-item").addClass("hidden-search");
						
						array.forEach(titles, lang.hitch(this, function(title) {
							var regex = new RegExp($.ui.autocomplete.escapeRegex(request.term),"i");
							if(title.match(regex)) {
								//
								regex = new RegExp($.ui.autocomplete.escapeRegex(title),"i");
								result = $.grep($(".playlist-item"),function(el){
									return ($(el).find(".item-title div").html().match(regex));
								});
								_searchResults = result;
								filterplaylistItems(result);
							}							
						}));
						} else if (_searchType == "communityBoundary") {
							//Handle Community Boundary Search
							prepareQT(window.configOptions.communityBoundaryServiceUrl, request.term, "NAME");				
						} else if (_searchType == "wards") {
							//Handle Wards Search
							prepareQT(window.configOptions.communityWardsServiceUrl, request.term, "NAME");
						}	
					},
					close: function(){
						if ($(searchSelector).val() === ""){
							$(".playlist-item").removeClass("hidden-search");
							$("#search-submit").addClass("icon-search").removeClass("icon-close");	
							setItemResults();
						}
					},
					change: function(){
						if ($(searchSelector).val() === ""){
							$(".playlist-item").removeClass("hidden-search");
							$("#search-submit").addClass("icon-search").removeClass("icon-close");
							setItemResults();
						}
					},
					open: function() {
						//We don't want to see dropdown
						$(".ui-autocomplete").hide();
					}
				});

				$(searchSelector).blur(function(){					
					if ($(searchSelector).val() === ""){
						$(".playlist-item").removeClass("hidden-search");
						$("#search-submit").addClass("icon-search").removeClass("icon-close");
						setItemResults();
					}
				});

				$("#search-submit").click(function(){
					if ($(this).hasClass("icon-close")){
						$(searchSelector).val("");
						$(".playlist-item").removeClass("hidden-search");
						$(this).addClass("icon-search").removeClass("icon-close");
						setItemResults();	
					}
				});
			}
		}
		function prepareQT (serviceUrl, searchTerm, attributeToSearch) {
		//Prepare esri Query Task to retrieve a desired geometry
		var query = new Query();
		var whereStatement = attributeToSearch + " LIKE '%" + searchTerm + "%'";
		query.where = whereStatement;
		query.returnGeometry = true;
		
		var queryTask = new QueryTask(serviceUrl);
		queryTask.execute(query, handleQT);
		}
		function handleQT (featureSet) {
			
			if(featureSet.features && featureSet.features.length > 0 ) {
			//Take first item and use that geometry
			var boundary = featureSet.features[0];
			getIntersectingItems(boundary);
			} 
		}
		
		function getIntersectingItems (geometryBoundary) {
			//Using geometryBoundary, find all the intersecting features from layersIdsToCheckforIntersect
			
			var map = kernel.global.map;
			var defs = [];
			
			array.forEach(layersIdsToCheckforIntersect, lang.hitch(this, function(id) {
				//
				var layer = map.getLayer(id);
				if(layer) {				
					if(layer.queryFeatures) {
						var query = new Query();
						
						var deferred = new Deferred();
						defs.push(deferred.promise);
						
						query.geometry = geometryBoundary.geometry;
						if(map.timeExtent) {
							query.timeExtent = map.timeExtent;
						}
						
						$(".playlist-item").addClass("hidden-search");
						
						layer.queryFeatures(query, lang.hitch(this, function(featureSet) {
							if(featureSet.features && featureSet.features.length > 0) {
								var items = [];
								
								array.forEach(featureSet.features, function(feat) {
									var item = {
										layerId: layer.id,
										objectId: feat.attributes.OBJECTID
									};
									//Filter playlist based on the attributes(configOptions.dataFields.nameField) of the items
									var regex = new RegExp($.ui.autocomplete.escapeRegex(feat.attributes[configOptions.dataFields.nameField]),"i");

									var result = $.grep($(".playlist-item"),function(el){
										return ($(el).find(".item-title div").html().match(regex));
									});
									
									filterplaylistItems(result);
									items.push(item);					
								});
								deferred.resolve(items);
							} else {
								deferred.resolve([]);
							}
						}), lang.hitch(this, handleError));
					}
				} else {
					console.warn('layer : ', id, " does not exist.");
				}				
			}));

			//Wait until all deferred are complete to call onSearch
			all(defs).then(function(results) {
				var items = [];
				array.forEach(results, function(itemArray) {
					array.forEach(itemArray, function(item) {
						items.push(item);
					});					
				});
				
				onSearch(items);
			});
		}
		function handleError (error) {
			console.error("Error Occurred : ", error.message);
		}
		
		function buildList(lyrItems)
		{
			for (var layerId in lyrItems){
				var items = lyrItems[layerId];
				var attr = getAttributeNames(items[0].graphic.attributes);
				var titleAttr = {
					layerId: layerId,
					fieldName: attr.name
				};
				onGetTitleField(titleAttr);
				array.forEach(items,function(item){
					var objId = item.graphic.attributes[item.objectIdField];
					var itemStr = "";
					if (attr.thumbnail){
						itemStr = '\
							<div class="playlist-item" layer-id="' + layerId + '" object-id="' + objId + '" data-filter="' + item.filter + '">\
								<table>\
									<tbody>\
										<tr>\
											<td class="marker-cell">\
												<img src=' + window.configOptions.playListMarkerIconLocationUrl + 'NumberIcon' + objId + '.png alt="" class="marker" />\
											</td>\
											<td class="thumbnail-cell">\
												<div class="thumbnail-container" style="background-image: url(' + item.thumbnailUrl + '); filter: progid:DXImageTransform.Microsoft.AlphaImageLoader(src="' + item.graphic.attributes[attr.thumbnail] + '", sizingMethod="scale");"></div>\
											</td>\
											<td class="title-cell">\
												<h6 class="item-title">' + item.graphic.attributes[window.configOptions.dataFields.nameField] + '</h6>\
											</td>\
										</tr>\
									</tbody>\
								</table>\
							</div>\
						';
					}
					else{
						itemStr = '\
							<div class="playlist-item no-image" layer-id="' + layerId + '" object-id="' + objId + '" data-filter="' + item.filter + '">\
								<table>\
									<tbody>\
										<tr>\
											<td class="marker-cell">\
												<img src=' + item.iconURL + ' alt="" class="marker" />\
											</td>\
											<td class="title-cell">\
												<h6 class="item-title">' + item.graphic.attributes[window.configOptions.dataFields.nameField] + '</h6>\
											</td>\
										</tr>\
									</tbody>\
								</table>\
							</div>\
						';
					}
					if ($.inArray(item.filter,_filterSet) < 0){
						addNewFilter(item.filter);
					}
					_listEl.append(itemStr);
				});			
			}
			$(".item-title").ellipsis();

			addEvents();
		}

		function addNewFilter(filter)
		{
			_filterSet.push(filter);

			$(filterSelector).append('<label class="filter-select">' + filter + '<input type="checkbox" checked></label>');
			$(".filter-select").last().click(function(){
				if ($(this).find("input").prop("checked")){
					$(".playlist-item[data-filter='" + filter + "']").removeClass("hidden-filter");
				}
				else{
					$(".playlist-item[data-filter='" + filter + "']").addClass("hidden-filter");
				}
				setItemResults();
			});

			if (_filterSet.length > 1){
				$(searchSelector).css("width",240);
				$("#search-submit").css("right",45);
				$("#filter-wrapper").show();
			}
		}

		function addEvents()
		{
			$(".playlist-item").click(function(){
				if ($(this).hasClass("selected")){
					onSelect(item,true);
				}
				else{
					$(".playlist-item").removeClass("selected");
					$(this).addClass("selected");
					var item = {
						layerId: $(this).attr("layer-id"),
						objectId: $(this).attr("object-id")
					};
					onSelect(item,false);
				}
			});

			if(!has("touch")){
				$(".playlist-item").mouseover(function(){
					$(".playlist-item").removeClass("highlight");
					$(this).addClass("highlight");
					var item = {
						layerId: $(this).attr("layer-id"),
						objectId: $(this).attr("object-id")
					};
					
					onHighlight(item);
				});

				$(selector).mouseout(function(){
					$(".playlist-item").removeClass("highlight");
					onRemoveHightlight();
				});
			}

			$(".select-all").click(function(){
				if ($(this).find("input").prop("checked")){
					$(".filter-select input").prop("checked", true);
					$(".playlist-item").removeClass("hidden-filter");

				}
				else{
					$(".filter-select input").prop("checked", false);
					$(".playlist-item").addClass("hidden-filter");
				}
				setItemResults();
			});
		}

		function setItemResults()
		{
			var items = [];
			if ($(".playlist-item:hidden").length > 0){
				if ($(".playlist-item:visible").length > 0){
					$(".playlist-item:visible").each(function(){
						var item = {
							layerId: $(this).attr("layer-id"),
							objectId: $(this).attr("object-id")
						};
						items.push(item);
					});
				}
				else{
					items = null;
				}
			}
			onSearch(items);
		}

		function getAttributeNames(obj) {
			var attrNames = {},
			udrScr = new RegExp (/"_"/i),
			url = new RegExp (/http/i),
			img = new RegExp (/(?:.jpe?g|.gif|.png)/i);

			for (var prop in obj){
				if (typeof(obj[prop]) === 'string'){
					if (prop === "title"){
						attrNames.title = "title";
					}
					else if (prop === "Title"){
						attrNames.title = "Title";
					}
					else if (prop === "TITLE"){
						attrNames.title = "TITLE";
					}
					else if (prop === "name"){
						attrNames.title = "name";
					}
					else if (prop === "Name"){
						attrNames.title = "Name";
					}
					else if (prop === "NAME"){
						attrNames.title = "NAME";
					}
					else if (prop === "thumbnail"){
						attrNames.thumbnail = "thumbnail";
					}
					else if (prop === "Thumbnail"){
						attrNames.thumbnail = "Thumbnail";
					}
					else if (prop === "thumbnail"){
						attrNames.thumbnail = "THUMBNAIL";
					}
					else if (prop === "thumb_url"){
						attrNames.thumbnail = "thumb_url";
					}
					else if (prop === "Thumb_Url"){
						attrNames.thumbnail = "Thumb_Url";
					}
					else if (prop === "Thumb_URL"){
						attrNames.thumbnail = "Thumb_URL";
					}
					else if (prop === "THUMB_URL"){
						attrNames.thumbnail = "THUMB_URL";
					}
					else if (img.test(obj[prop]) && url.test(obj[prop])){
						if(!attrNames.thumbnail){
							attrNames.thumbnail = prop;
						}
					}
					else if (!udrScr.test(obj[prop]) && obj[prop].length > 1 && !url.test(obj[prop])){
						if(!attrNames.title){
							attrNames.title = prop;
						}
					}
				}
			}
			if (dataFields.imageField){
				attrNames.thumbnail = dataFields.imageField;
			}
			if (dataFields.nameField){
				attrNames.title = dataFields.nameField;
			}
			return attrNames;
		}
	};
});