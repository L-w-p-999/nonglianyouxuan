const WXAPI = require('apifm-wxapi')

/**
 * type: order 支付订单 recharge 充值 paybill 优惠买单
 * data: 扩展数据对象，用于保存参数
 */
function wxpay(type, money, orderId, redirectUrl, data) {
  console.log('========== 支付开始 ==========');
  console.log('支付类型:', type);
  console.log('支付金额:', money);
  console.log('订单ID:', orderId);
  console.log('跳转路径:', redirectUrl);
  console.log('扩展数据:', data);
  
  const postData = {
    token: wx.getStorageSync('token'),
    money: money,
    remark: "在线充值",
  }
  if (type === 'order') {
    postData.remark = "支付订单 ：" + orderId;
    postData.nextAction = {
      type: 0,
      id: orderId
    };
    
    // 生成商品详情描述（用于微信订单管理）
    let description = '';
    if (data && data.goodsList && Array.isArray(data.goodsList) && data.goodsList.length > 0) {
      // 如果有商品列表，生成商品详情
      const goodsNames = data.goodsList.map(item => {
        let name = item.name || '';
        if (item.sku && item.sku.length > 0) {
          const skuStr = item.sku.map(s => `${s.optionName}:${s.optionValueName}`).join(' ');
          name += ' ' + skuStr;
        }
        return name + ' x' + (item.number || 1);
      });
      description = goodsNames.join('；');
      
      // 限制长度，微信要求description不超过127个字符
      if (description.length > 127) {
        description = description.substring(0, 124) + '...';
      }
    } else {
      // 如果没有商品列表，使用默认描述
      description = '商品订单';
    }
    
    // 添加description字段（微信订单管理要求）
    postData.description = description;
    console.log('商品详情描述:', description);
  }
  if (type === 'paybill') {
    postData.remark = "优惠买单 ：" + data.money;
    postData.nextAction = {
      type: 4,
      uid: wx.getStorageSync('uid'),
      money: data.money
    };
    postData.description = '优惠买单';
  }
  postData.payName = postData.remark;
  if (postData.nextAction) {
    postData.nextAction = JSON.stringify(postData.nextAction);  
  }
  
  console.log('支付请求参数:', JSON.stringify(postData, null, 2));
  
  WXAPI.wxpay(postData).then(function (res) {
    console.log('========== 支付API返回 ==========');
    console.log('返回码:', res.code);
    console.log('返回消息:', res.msg);
    console.log('返回数据:', JSON.stringify(res.data, null, 2));
    if (res.code == 0) {
      console.log('========== 发起微信支付 ==========');
      console.log('timeStamp:', res.data.timeStamp);
      console.log('nonceStr:', res.data.nonceStr);
      console.log('prepayId:', res.data.prepayId);
      console.log('signType:', res.data.signType);
      console.log('paySign:', res.data.sign);
      
      // 发起支付
      wx.requestPayment({
        timeStamp: res.data.timeStamp,
        nonceStr: res.data.nonceStr,
        package: 'prepay_id=' + res.data.prepayId,
        signType: res.data.signType,
        paySign: res.data.sign,
        fail: function (err) {
          console.log('========== 微信支付失败 ==========');
          console.log('错误对象:', JSON.stringify(err, null, 2));
          console.log('错误信息:', err.errMsg);
          console.log('错误码:', err.errCode || '无');
          console.log('完整错误:', err);
          
          wx.showToast({
            title: '支付失败',
            icon: 'none',
            duration: 3000
          });
          
          // 显示详细错误信息（开发环境）
          if (err.errMsg) {
            console.error('支付失败详情:', err.errMsg);
          }
        },
        success: function () {
          console.log('========== 微信支付成功 ==========');
          console.log('支付类型:', type);
          console.log('订单ID:', orderId);
          
          // 提示支付成功
          wx.showToast({
            title: '支付成功'
          })
          // 如果是订单支付，跳转到订单详情页，包含订单号参数
          let finalUrl = redirectUrl;
          if (type === 'order' && orderId) {
            finalUrl = "/pages/order-details/index?id=" + orderId;
          }
          console.log('跳转路径:', finalUrl);
          wx.redirectTo({
            url: finalUrl
          });
        }
      })
    } else {
      console.log('========== 支付API调用失败 ==========');
      console.log('错误码:', res.code);
      console.log('错误消息:', res.msg);
      console.log('完整返回:', JSON.stringify(res, null, 2));
      
      wx.showModal({
        title: '出错了',
        content: '错误码: ' + res.code + '\n错误信息: ' + (res.msg || '未知错误'),
        showCancel: false
      })
    }
  }).catch(function (error) {
    console.log('========== 支付API异常 ==========');
    console.log('异常信息:', JSON.stringify(error, null, 2));
    console.log('异常堆栈:', error.stack || '无');
    
    wx.showModal({
      title: '网络错误',
      content: '支付请求失败，请检查网络连接\n' + (error.message || JSON.stringify(error)),
      showCancel: false
    })
  })
}

module.exports = {
  wxpay: wxpay
}