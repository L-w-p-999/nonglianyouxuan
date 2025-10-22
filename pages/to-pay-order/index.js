const app = getApp()
const WXAPI = require('apifm-wxapi')
const AUTH = require('../../utils/auth')
const wxpay = require('../../utils/pay.js')
const tools = require('../../utils/tools.js')

Page({
	data: {
		wxlogin: true,
		totalScoreToPay: 0,
		goodsList: [],
		isNeedLogistics: 1, // 是否需要物流信息
		allGoodsPrice: 0,
		yunPrice: 0,
		allGoodsAndYunPrice: 0,
		goodsJsonStr: "",
		orderType: "", //订单类型，购物车下单或立即支付下单，默认是购物车，
		pingtuanOpenId: undefined, //拼团的话记录团号

		hasNoCoupons: true,
		coupons: [],
		youhuijine: 0, //优惠券金额
		curCoupon: null, // 当前选择使用的优惠券
		allowSelfCollection: '0', // 是否允许到店自提
		peisongType: 'kd', // 配送方式 kd,zq 分别表示快递/到店自取
		remark: '',
		showModal: false, //是否显示微信支付modal
		payAmount: null,
		payId: null,
		curAddressData: null, // 当前收货地址
	},
	onShow() {
		AUTH.checkHasLogined().then(isLogined => {
			this.setData({
				wxlogin: isLogined
			})
			if(isLogined){
				this.doneShow()
			}
		})
	},
	async doneShow() {
		let allowSelfCollection = wx.getStorageSync('ALLOW_SELF_COLLECTION')
		if (!allowSelfCollection || allowSelfCollection != '1') {
			allowSelfCollection = '0'
			this.data.peisongType = 'kd'
		}
		let shopList = [];
		const token = wx.getStorageSync('token')
		//立即购买下单
		if ("buyNow" == this.data.orderType) {
			var buyNowInfoMem = wx.getStorageSync('buyNowInfo');
			this.data.kjId = buyNowInfoMem.kjId;
			if (buyNowInfoMem && buyNowInfoMem.shopList) {
				shopList = buyNowInfoMem.shopList
			}
		} else {
			//购物车下单
			const res = await WXAPI.shippingCarInfo(token)
			if (res.code == 0) {
				shopList = res.data.items
			}
		}
		this.setData({
			goodsList: shopList,
			allowSelfCollection: allowSelfCollection,
			peisongType: this.data.peisongType
		});
		
		// 初始化收货地址
		await this.initShippingAddress()
		
		// 打印调试信息
		console.log('=== 订单确认页面状态 ===')
		console.log('是否需要物流:', this.data.isNeedLogistics)
		console.log('配送方式:', this.data.peisongType)
		console.log('当前地址:', this.data.curAddressData)
		console.log('商品列表:', this.data.goodsList)
	},

	onLoad(e) {
		let _data = {
			isNeedLogistics: 1, // 默认需要物流
			curAddressData: null // 初始化为空
		}
		if (e.orderType) {
			_data.orderType = e.orderType
		}
		if (e.pingtuanOpenId) {
			_data.pingtuanOpenId = e.pingtuanOpenId
		}
		this.setData(_data);
	},

	getDistrictId: function(obj, aaa) {
		if (!obj) {
			return "";
		}
		if (!aaa) {
			return "";
		}
		return aaa;
	},
	remarkChange(e) {
		this.data.remark = e.detail.value
	},
	goCreateOrder() {
		wx.requestSubscribeMessage({
			tmplIds: ['Z0hQYItP4ct2VbxbWMGp61SH0_4zmDB-52WQpHQ1jco'], 
			success(res) {

			},
			fail(e) {
				console.error(e)
			},
			complete: (e) => {
				this.createOrder(true)
			},
		})
	},
	createOrder: function(e) {
		var that = this;
		var loginToken = wx.getStorageSync('token') // 用户登录 token
		var remark = this.data.remark; // 备注信息

		let postData = {
			token: loginToken,
			goodsJsonStr: that.data.goodsJsonStr,
			remark: remark,
			peisongType: that.data.peisongType
		};
		if (that.data.kjId) {
			postData.kjid = that.data.kjId
		}
		if (that.data.pingtuanOpenId) {
			postData.pingtuanOpenId = that.data.pingtuanOpenId
		}
		
		// 快递配送时，检查地址（不再判断 isNeedLogistics）
		if (postData.peisongType == 'kd') {
			if (!that.data.curAddressData && loginToken && e) {
				// 只在真正提交订单时(e为true)才检查地址
				wx.hideLoading();
				wx.showModal({
					title: '提示',
					content: '请先添加收货地址',
					confirmText: '去添加',
					success(res) {
						if (res.confirm) {
							that.addAddress()
						}
					}
				})
				return;
			}
			
			// 有地址时设置地址信息
			if (that.data.curAddressData) {
				postData.provinceId = that.data.curAddressData.provinceId;
				postData.cityId = that.data.curAddressData.cityId;
				if (that.data.curAddressData.districtId) {
					postData.districtId = that.data.curAddressData.districtId;
				}
				postData.address = that.data.curAddressData.address;
				postData.linkMan = that.data.curAddressData.linkMan;
				postData.mobile = that.data.curAddressData.mobile;
				postData.code = that.data.curAddressData.code;
			}
		}
		
		if (that.data.curCoupon) {
			postData.couponId = that.data.curCoupon.id;
		}
		if (!e) {
			postData.calculate = "true";
		}

		WXAPI.orderCreate(postData).then(function(res) {
			if (res.code != 0) {
				wx.showModal({
					title: '错误',
					content: res.msg,
					showCancel: false
				})
				return;
			}

			if (e && "buyNow" != that.data.orderType) {
				// 清空购物车数据
				WXAPI.shippingCarInfoRemoveAll(loginToken)
			}
			if (!e) {
				that.setData({
					totalScoreToPay: res.data.score,
					isNeedLogistics: res.data.isNeedLogistics,
					allGoodsPrice: res.data.amountTotle,
					allGoodsAndYunPrice: res.data.amountLogistics + res.data.amountTotle,
					yunPrice: res.data.amountLogistics
				});
				that.getMyCoupons();
				return;
			}
			// 下单成功，跳转到支付
			that.setData({
				showModal: true,
				payAmount: res.data.amountReal,
				payId: res.data.id
			})
		})
	},
	toPay() {
		if (this.data.totalScoreToPay > 0) {
			WXAPI.userAmount(wx.getStorageSync('token')).then(res => {
				if (res.data.score < this.data.totalScoreToPay) {
					wx.showToast({
						title: '您的积分不足，无法支付',
						icon: 'none'
					})
					return;
				} else {
					wxpay.wxpay('order', this.data.payAmount, this.data.payId,
						"/pages/order-list/index?type=0");
				}
			})
		} else {
			wxpay.wxpay('order', this.data.payAmount, this.data.payId,
				"/pages/order-list/index?type=1");
		}
	},
	hideModal() {
		wx.redirectTo({
			url: "/pages/order-list/index"
		});
	},
	async initShippingAddress() {
		const res = await WXAPI.defaultAddress(wx.getStorageSync('token'))
		if (res.code == 0 && res.data && res.data.info) {
			// 有默认地址
			this.setData({
				curAddressData: res.data.info
			});
			console.log('已加载默认地址:', res.data.info)
		} else {
			// 没有默认地址
			this.setData({
				curAddressData: null
			});
			console.log('暂无收货地址')
		}
		this.processYunfei();
	},
	processYunfei() {
		var goodsList = this.data.goodsList;
		var goodsJsonStr = "[";
		var isNeedLogistics = 0;
		var allGoodsPrice = 0;

		let inviter_id = 0;
		let inviter_id_storge = wx.getStorageSync('referrer');
		if (inviter_id_storge) {
			inviter_id = inviter_id_storge;
		}
		
		for (let i = 0; i < goodsList.length; i++) {
			let carShopBean = goodsList[i];
			// 检查商品是否需要物流
			if (carShopBean.logistics || carShopBean.logisticsId) {
				isNeedLogistics = 1;
			}
			
			// 调试：打印商品信息
			console.log('商品', i, ':', carShopBean.name)
			console.log('  - logistics:', carShopBean.logistics)
			console.log('  - logisticsId:', carShopBean.logisticsId)
			allGoodsPrice += carShopBean.price * carShopBean.number;

			var goodsJsonStrTmp = '';
			if (i > 0) {
				goodsJsonStrTmp = ",";
			}
			if (carShopBean.sku && carShopBean.sku.length > 0) {
				let propertyChildIds = ''
				carShopBean.sku.forEach(option => {
					propertyChildIds = propertyChildIds + ',' + option.optionId + ':' + option.optionValueId
				})
				carShopBean.propertyChildIds = propertyChildIds
			}
			goodsJsonStrTmp += '{"goodsId":' + carShopBean.goodsId + ',"number":' + carShopBean.number +
				',"propertyChildIds":"' + carShopBean.propertyChildIds + '","logisticsType":0, "inviter_id":' + inviter_id + '}';
			goodsJsonStr += goodsJsonStrTmp;
		}
		goodsJsonStr += "]";
		
		// 临时强制需要物流 - 用于测试
		if (isNeedLogistics === 0) {
			console.warn('⚠️ 商品未设置物流信息，强制启用物流功能')
			isNeedLogistics = 1
		}
		
		this.setData({
			isNeedLogistics: isNeedLogistics,
			goodsJsonStr: goodsJsonStr
		});
		
		console.log('最终 isNeedLogistics:', isNeedLogistics)
		this.createOrder();
	},
	addAddress: function() {
		wx.navigateTo({
			url: "/pages/address-add/index"
		})
	},
	selectAddress: function() {
		wx.navigateTo({
			url: "/pages/select-address/index"
		})
	},
	getMyCoupons: function() {
		var that = this;
		WXAPI.myCoupons({
			token: wx.getStorageSync('token'),
			status: 0
		}).then(function(res) {
			if (res.code == 0) {
				// 过滤不满足满减最低金额的优惠券
				var coupons = res.data.filter(entity => {
					return entity.moneyHreshold <= that.data.allGoodsAndYunPrice;
				});
				
				var dayTime = tools.formatTime(new Date());
				//过滤还没到可以使用时间的优惠券
				coupons = coupons.filter(entity =>{
				    return entity.dateStart <= dayTime;
				});
				
				if (coupons.length > 0) {
					that.setData({
						hasNoCoupons: false,
						coupons: coupons
					});
				}
			}
		})
	},
	bindChangeCoupon: function(e) {
		const selIndex = e.detail.value[0] - 1;
		if (selIndex == -1) {
			this.setData({
				youhuijine: 0,
				curCoupon: null
			});
			return;
		}
		this.setData({
			youhuijine: this.data.coupons[selIndex].money,
			curCoupon: this.data.coupons[selIndex]
		});
	},
	radioChange(e) {
		this.setData({
			peisongType: e.detail.value
		})
		this.processYunfei()
	},
	
	// 调试方法：清空地址测试 - 上线前删除
	debugClearAddress() {
		this.setData({
			curAddressData: null,
			isNeedLogistics: 1,
			peisongType: 'kd'
		})
		wx.showToast({
			title: '已清空地址，应该能看到新增按钮了',
			icon: 'none',
			duration: 2000
		})
		console.log('=== 调试：强制清空地址 ===')
		console.log('curAddressData:', this.data.curAddressData)
		console.log('isNeedLogistics:', this.data.isNeedLogistics)
		console.log('peisongType:', this.data.peisongType)
	},
})