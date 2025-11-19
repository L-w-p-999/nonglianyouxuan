const app = getApp();
const CONFIG = require('../../config.js')
const WXAPI = require('apifm-wxapi')
Page({
    data:{
      orderId:0,
      goodsList:[]
    },
    onLoad:function(e){
      console.log('========== 订单详情页加载 ==========');
      console.log('接收到的参数:', JSON.stringify(e, null, 2));
      
      // 兼容多种参数名：id、orderId、out_trade_no（微信订单中心可能使用的参数名）
      var orderId = e.id || e.orderId || e.out_trade_no;
      
      console.log('解析后的订单ID:', orderId);
      
      if (!orderId) {
        console.error('未获取到订单ID，参数:', e);
        wx.showModal({
          title: '提示',
          content: '订单信息有误，请重新进入',
          showCancel: false,
          success: function() {
            wx.navigateBack();
          }
        });
        return;
      }
      
      this.data.orderId = orderId;
      this.setData({
        orderId: orderId,
        appid: wx.getStorageSync('wxAppid')
      });
    },
    onShow : function () {
      var that = this;
      WXAPI.orderDetail(wx.getStorageSync('token'), that.data.orderId).then(function (res) {
        if (res.code != 0) {
          wx.showModal({
            title: '错误',
            content: res.msg,
            showCancel: false
          })
          return;
        }
        that.setData({
          orderDetail: res.data
        });
      })
    },
    wuliuDetailsTap:function(e){
      var orderId = e.currentTarget.dataset.id;
      wx.navigateTo({
        url: "/pages/wuliu/index?id=" + orderId
      })
    },
    confirmBtnTap:function(e){
      let that = this;
      let orderId = this.data.orderId;
      wx.showModal({
          title: '确认您已收到商品？',
          content: '',
          success: function(res) {
            if (res.confirm) {
              WXAPI.orderDelivery(wx.getStorageSync('token'), orderId).then(function (res) {
                if (res.code == 0) {
                  that.onShow();                  
                }
              })
            }
          }
      })
    },
    submitReputation: function (e) {
      let that = this;
      let postJsonString = {};
      postJsonString.token = wx.getStorageSync('token');
      postJsonString.orderId = this.data.orderId;
      let reputations = [];
      let i = 0;
      while (e.detail.value["orderGoodsId" + i]) {
        let orderGoodsId = e.detail.value["orderGoodsId" + i];
        let goodReputation = e.detail.value["goodReputation" + i];
        let goodReputationRemark = e.detail.value["goodReputationRemark" + i];

        let reputations_json = {};
        reputations_json.id = orderGoodsId;
        reputations_json.reputation = goodReputation;
        reputations_json.remark = goodReputationRemark;

        reputations.push(reputations_json);
        i++;
      }
      postJsonString.reputations = reputations;
      WXAPI.orderReputation({
        postJsonString: JSON.stringify(postJsonString)
      }).then(function (res) {
        if (res.code == 0) {
          that.onShow();
        }
      })
    }
})