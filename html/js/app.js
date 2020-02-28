$(function() {
  var defaults = {
    agent: 'ALL',
    datasource: 'ALL',
    aggregation: 'max'
  };

  var state = {};
  $.extend(state,defaults);

  function createQuery(params) {
    var query, key, value;
    for(key in params) {
      value = params[key];
      if(value === defaults[key]) continue;
      if(query) query += '&';
      else query = '';
      query += encodeURIComponent(key)+'='+encodeURIComponent(value);
    }
    return query;
  }

  function getState(key, defVal) {
    return window.sessionStorage.getItem('mb_'+key) || state[key] || defVal;
  }

  function setState(key, val, showQuery) {
    state[key] = val;
    window.sessionStorage.setItem('mb_'+key, val);
    if(showQuery) {
      var query = createQuery(state);
      window.history.replaceState({},'',query ? '?' + query : './');
    }
  }

  function setQueryParams(query) {
    var vars = query.split('&');
    var params = {};
    for(var i = 0; i < vars.length; i++) {
      var pair = vars[i].split('=');
      if(pair.length === 2) setState(decodeURIComponent(pair[0]), decodeURIComponent(pair[1]),false);
    }
  }

  var search = window.location.search;
  if(search) setQueryParams(search.substring(1));

  $('#clone').click(function() {
     window.open(window.location);
  }); 
 
  var selectedAgent = getState('agent');
  var selectedMetric = getState('metric');
  var selectedDatasource = getState('datasource');
  var selectedAggregation = getState('aggregation');

  var names = {};
  var maxPoints = 5 * 60;
  var step = 1000;
  var chartData;

  var nf = $.inmon.stripchart.prototype.valueStr;

  var widget = $('#chart').stripchart();
  
  function resetChart() {
    chartData = {times:[], values: []};
    var i, t = Date.now();
    for(i = 0; i < maxPoints; i++) {
      t = t - step;
      chartData.times.unshift(t);
    }
    var series = new Array(chartData.times.length);
    for(i = 0; i < chartData.times.length; i++) series[i] = 0;
    chartData.values.push(series);
  }
  function updateChart(data) {
    if(!data || data.length === 0) return;
    if(!chartData) resetChart();

    var now = Date.now();
    chartData.times.push(now);
    var tmin = now - (maxPoints * 1.04 * step);
    var nshift = 0;
    while(chartData.times.length >= maxPoints || chartData.times[0] < tmin) {
      chartData.times.shift();
      nshift++;
    }
    var series = chartData.values[0];
    var val = data[0].metricValue;
    series.push($.isNumeric(val) ? val : 0);
    for(var i = 0; i < nshift; i++) {
      series.shift();
    }
    widget.stripchart("draw", chartData);
    $('#metric-agent').text(data[0].agent || '');
    $('#metric-datasource').text(data[0].dataSource || '');
    $('#metric-value').text($.isNumeric(val) ? nf(val) : val);
    $('#metric-n').text(data[0].metricN || '');
  }

  $(window).resize(function() {
    widget.stripchart("draw", chartData);
  });

  function updateMetrics() {
    names = {};
    if('ALL' == selectedAgent) {
      $.get('../../../metrics/json', function(metrics) {
        var metricSelect = $('#metric');
        var dsSelect = $('#datasource');
        var i, metricsList = Object.keys(metrics).sort();
        if(!metrics[selectedMetric]) {
          selectedMetric = metricsList[0];
          setState('metric',selectedMetric,true);
        }
        metricSelect.empty();
        for(i = 0; i < metricsList.length; i++) {
          metricSelect.append('<option value="'+metricsList[i]+'"' + (selectedMetric == metricsList[i] ? ' selected' : '') + '>'+metricsList[i]+'</option>');
        }
        dsSelect.empty();
        dsSelect.append('<option value="ALL" selected>ALL</option>');
        selectedDatasource = 'ALL';
        setState('datasource',selectedDatasource,true);
        resetChart();
      });
    } else {
      $.get('../../../metric/'+selectedAgent+'/json',function(metrics) {
        var metricSelect = $('#metric');
        var dsSelect = $('#datasource');
        var i, idx, ds, dsList, name, nameList, metricsList = Object.keys(metrics);
        for(i = 0; i < metricsList.length; i++) {
          idx = metricsList[i].lastIndexOf('.');
          ds = metricsList[i].substring(0,idx);
          name = metricsList[i].substring(idx+1);
          dsList = names[name];
          if(!dsList) {
            dsList = [];
            names[name] = dsList;
          };
          dsList.push(ds); 
        }
        nameList = Object.keys(names).sort();
        if(!names[selectedMetric]) {
          selectedMetric = nameList[0];
          setState('metric',selectedMetric,true);
        }
        metricSelect.empty();
        for(i = 0; i < nameList.length; i++) {
          metricSelect.append('<option value="'+nameList[i]+'"' + (selectedMetric == nameList[i] ? ' selected' : '') + '>'+nameList[i]+'</option>');
        }
        dsList = names[selectedMetric].sort((a,b) => a - b);
        dsSelect.empty();
        dsSelect.append('<option value="ALL"'+('ALL' === selectedDatasource ? ' selected' : '')+'>ALL</option>');
        for(i = 0; i < dsList.length; i++) {
          dsSelect.append('<option value="'+dsList[i]+'"'+(dsList[i] === selectedDatasource ? ' selected' : '')+'>'+dsList[i]+'</options>');
        }
        resetChart();
      });
    }
  }
  $('#agent').change(function(evt) {
    selectedAgent = $('#agent').children('option:selected').val();
    setState('agent',selectedAgent,true);
    updateMetrics();
  });
  $('#metric').change(function(evt) {
    selectedMetric = $('#metric').children('option:selected').val();
    setState('metric',selectedMetric,true);
    var dsSelect = $('#datasource');
    var i, dsList = names[selectedMetric];
    dsSelect.empty();
    if(dsList) {
      dsList.sort((a,b) => a - b);
      dsSelect.append('<option value="ALL">ALL</option>');
      for(i = 0; i < dsList.length; i++) {
        dsSelect.append('<option value="'+dsList[i]+'">'+dsList[i]+'</options>');
      }
    } else {
      dsSelect.append('<option value="ALL" selected>ALL</option>');
    }
    resetChart();
  });
  $('#datasource').change(function(evt) {
    selectedDatasource = $('#datasource').children('option:selected').val();
    setState('datasource',selectedDatasource,true);
    resetChart();
  });
  $('#aggregation option[value="'+selectedAggregation+'"]').prop('selected',true);
  $('#aggregation').change(function(evt) {
    selectedAggregation = $('#aggregation').children('option:selected').val();
    setState('aggregation',selectedAggregation,true);
    resetChart();
  });
  $.get('../../../agents/json', function(agents) {
    var agentSelect = $('#agent');
    var i, agentList = Object.keys(agents).sort();
    agentSelect.append('<option value="ALL"'+('ALL' === selectedAgent ? ' selected' : '')+'>ALL</option>');
    for(i = 0; i < agentList.length; i++) {
      agentSelect.append('<option value="'+agentList[i]+'"'+(agentList[i] === selectedAgent ? ' selected' : '')+'>'+agentList[i]+'</option>'); 
    }
    updateMetrics();
    resetChart();
  });
  (function poll() {
    var metric = (!selectedDatasource || 'ALL' === selectedDatasource ? '' : selectedDatasource + '.') + selectedMetric;
    var url = '../../../metric/'+selectedAgent+'/'+selectedAggregation+':'+metric+'/json';
    $.ajax({
      url: url,
      success: function(data) {
        updateChart(data);
        setTimeout(poll, step);
      },
      error: function(result,status,errorThrown) {
        setTimeout(poll, 5000);
      },
      dataType: "json",
      timeout: 60000
    });
  })();
});
