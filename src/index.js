module.exports = function(rootSchema, option) {
  const { _, prettier } = option;

  const template = [];

  const imports = [];

  const utils = [];

  const datas = [];

  const components = [];

  const methods = [];

  const lifeCycles = [];

  const styles = [];

  const styles4rem = [];

  const styleImports = [];

  const boxStyleList = [
    'fontSize',
    'marginTop',
    'marginBottom',
    'paddingTop',
    'paddingBottom',
    'height',
    'top',
    'bottom',
    'width',
    'maxWidth',
    'left',
    'right',
    'paddingRight',
    'paddingLeft',
    'marginLeft',
    'marginRight',
    'lineHeight',
    'borderBottomRightRadius',
    'borderBottomLeftRadius',
    'borderTopRightRadius',
    'borderTopLeftRadius',
    'borderRadius'
  ];

  const noUnitStyles = [ 'opacity', 'fontWeight' ];

  const width = option.responsive.width || 750;
  const viewportWidth = option.responsive.viewportWidth || 375;
  const htmlFontsize = viewportWidth ? viewportWidth / 10 : null;

  // 1vw = width / 100
  const _w = width / 100;

  const _ratio = width / viewportWidth;

  const isExpression = (value) => {
    return /^\{\{.*\}\}$/.test(value);
  };

  const transformEventName = (name) => {
    return name.replace('on', '').toLowerCase();
  };

  const toString = (value) => {
    if ({}.toString.call(value) === '[object Function]') {
      return value.toString();
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, (key, value) => {
        if (typeof value === 'function') {
          return value.toString();
        } else {
          return value;
        }
      });
    }

    return String(value);
  };

  // convert to responsive unit, such as vw
  const parseStyle = (style, option = {}) => {
    const { toVW, toREM } = option;
    const styleData = [];
    for (let key in style) {
      let value = style[key];
      if (boxStyleList.indexOf(key) != -1) {
        if (toVW) {
          value = (parseInt(value) / _w).toFixed(2);
          value = value == 0 ? value : value + 'vw';
        } else if (toREM && htmlFontsize) {
          const valueNum = typeof value == 'string' ? value.replace(/(px)|(rem)/, '') : value;
          const fontSize = (valueNum * (viewportWidth / width)).toFixed(2);
          value = parseFloat((fontSize / htmlFontsize).toFixed(2));
          value =  value ? `${value}rem` : value;
        } else {
          if (typeof value === 'string') {
            const number = parseInt(value);
            const unit = value.replace(number, '');
            if (unit === 'px') {
              value = Math.floor((number / 2)).toFixed(2);
            } else {
              value = number.toFixed(2);
            }
            value = value + unit;
          } else if (typeof value === 'number') {
            value = Math.floor((value / 2)).toFixed(2) + 'px';
          }
        }
        styleData.push(`${_.kebabCase(key)}: ${value};`);
      } else if (noUnitStyles.indexOf(key) != -1) {
        styleData.push(`${_.kebabCase(key)}: ${parseFloat(value)};`);
      } else {
        styleData.push(`${_.kebabCase(key)}: ${value};`);
      }
    }
    return styleData.join('');
  };

  // parse function, return params and content
  const parseFunction = (func) => {
    const funcString = func.toString();
    const name = funcString.slice(funcString.indexOf('function'), funcString.indexOf('(')).replace('function ', '');
    const params = funcString.match(/\([^\(\)]*\)/)[0].slice(1, -1);
    const content = funcString.slice(funcString.indexOf('{') + 1, funcString.lastIndexOf('}'));
    return {
      params,
      content,
      name
    };
  };

  // parse layer props(static values or expression)
  const parseProps = (value, isReactNode) => {
    if (typeof value === 'string') {
      if (isExpression(value)) {
        return `{{${value.slice(2, -2).replace('this.', '')}}}`;
      }
      if (isReactNode) {
        return value;
      } else if (value.indexOf('$') === 0) {
        const data = value.slice(1, value.length)
        datas.push(`${data}: ''`);
        return `"${data}"`;
      } else {
        return `"${value}"`;
      }
    } else if (typeof value === 'function') {
      const { params, content, name } = parseFunction(value);
      methods.push(`${name}(${params}) {${content}}`);
      return name;
    } else {
      return `"${value}"`;
    }
  };

  const parsePropsKey = (key, value) => {
    if (typeof value === 'function') {
      return `@${transformEventName(key)}`;
    } else if (value.indexOf('$') === 0) {
      return `:${key}`;
    }
    return `${key}`;
  };

  // parse async dataSource
  const parseDataSource = (data) => {
    const name = data.id;
    const { uri, method, params } = data.options;
    const action = data.type;
    let payload = {};

    switch (action) {
      case 'fetch':
        break;
    }

    datas.push(`curPage: 1`);
    datas.push(`isLoading: false`);
    datas.push(`loading: false`);
    datas.push(`finished: false`);
    imports.push({
      name: 'remain-ui',
      value: ['rmPullRefresh', 'rmList']
    });
    components.push(...['rmPullRefresh', 'rmList']);
    methods.push(`onRefresh() {
      this.curPage = 1
      this.loading = true
      this.loadData()
    }`);
    let result = `const params = {
      curPage: this.curPage,
      pageSize: 20
    }
    const { status, data } = await this.$axios({
      url: '${data.options.uri}',
      method: '${data.options.method}',
      params
    })
    this.isLoading = false
    this.loading = false
    if (status === 100) {
      this.finished = !data.pageResult.hasMore
      if (this.curPage === 1) {
        this.loopData = data.resultList
      } else {
        this.loopData.push(...data.resultList)
      }
      this.curPage = this.curPage + 1
    } else {
      this.finished = true
    }`;

    // if (data.dataHandler) {
    //   const { params, content } = parseFunction(data.dataHandler);
    //   result += `.then((${params}) => {${content}})
    //     .catch((e) => {
    //       console.log('error', e);
    //     })
    //   `;
    // }

    // result += '}';

    return `async ${name}() {${result}}`;
  };

  // parse condition: whether render the layer
  const parseCondition = (condition, render) => {
    let _condition = isExpression(condition) ? condition.slice(2, -2) : condition;
    if (typeof _condition === 'string') {
      _condition = _condition.replace('this.', '');
    }
    render = render.replace(/^<\w+\s/, `${render.match(/^<\w+\s/)[0]} v-if="${_condition}" `);
    return render;
  };

  // parse loop render
  const parseLoop = (loop, loopArg, render) => {
    let data;
    let loopArgItem = (loopArg && loopArg[0]) || 'item';
    let loopArgIndex = (loopArg && loopArg[1]) || 'index';

    if (Array.isArray(loop)) {
      data = 'loopData';
      datas.push(`${data}: ${toString(loop)}`);
    } else if (isExpression(loop)) {
      data = loop.slice(2, -2).replace('this.state.', '');
    }
    // add loop key
    const tagEnd = render.indexOf('>');
    const keyProp = render.slice(0, tagEnd).indexOf('key=') == -1 ? `:key="${loopArgIndex}"` : '';
    render = `
      ${render.slice(0, tagEnd)}
      v-for="(${loopArgItem}, ${loopArgIndex}) in ${data}"  
      ${keyProp}
      ${render.slice(tagEnd)}`;

    // remove `this`
    const re = new RegExp(`this.${loopArgItem}`, 'g');
    render = render.replace(re, loopArgItem);

    return render;
  };

  // generate render xml
  const generateRender = (schema) => {
    const type = schema.componentName.toLowerCase();
    const className = schema.props && schema.props.className;
    const classString = className ? ` class="${className}"` : '';

    if (className) {
      styles.push(`
        .${className} {
          ${parseStyle(schema.props.style)}
      `);
      styles4rem.push(`
        .${className} {
          ${parseStyle(schema.props.style, { toREM: true })}
        }
      `);
    }

    let xml;
    let props = '';

    Object.keys(schema.props).forEach((key) => {
      if (['className', 'style', 'text', 'src', 'lines', 'remain-refresh-list', 'remain-filter-popup'].indexOf(key) === -1) {
        props += ` ${parsePropsKey(key, schema.props[key])}=${parseProps(schema.props[key])}`;
      }
    });
    switch (type) {
      case 'text':
        const innerText = parseProps(schema.props.text, true);
        xml = `<span${classString}${props}>${innerText}</span> `;
        break;
      case 'image':
        let source = parseProps(schema.props.src, false);
        if (!source.match('"')) {
          source = `"${source}"`;
          xml = `<img${classString}${props} :src=${source} /> `;
        } else {
          xml = `<img${classString}${props} src=${source} /> `;
        }
        break;
      case 'div':
      case 'page':
      case 'block':
      case 'component':
        if (schema.children && schema.children.length) {
          xml = `<div${classString}${props}>${transform(schema.children)}</div>`;
        } else {
          xml = `<div${classString}${props} />`;
        }
        if (schema.props['remain-refresh-list'] === '1') {
          xml = `<rm-pull-refresh
            v-model="isLoading"
            @refresh="onRefresh"
          >
            <rm-list
              v-if="loopData.length > 0"
              v-model="loading"
              :finished="finished"
              finished-text="没有更多了"
              @load="loadData"
            >${xml}</rm-list>
            <div v-else class="empty">
              <span>暂无数据</span>
            </div>
          </rm-pull-refresh>`
        } else if (schema.props['remain-filter-popup'] === '1') {
          const classNameCamelCase = className.replace(/\-(\w)/g, function (all, letter) {
            return letter.toUpperCase();
          });
          datas.push(`${classNameCamelCase}Visible: false`);
          datas.push(`types: [{
            name: '全部',
            id: undefined
          }, {
            name: '分类1',
            id: '1'
          }, {
            name: '分类2',
            id: '2'
          }]`);
          datas.push(`type: {}`);
          methods.push(`typeClick(type) {
            this.type = type
          }`);
          methods.push(`submitClick() {
            this.${classNameCamelCase}Visible = false
          }`);
          imports.push({
            name: 'remain-ui',
            value: ['rmPopup', 'rmGrid', 'rmGridItem', 'rmButton']
          });
          components.push(...['rmPopup', 'rmGrid', 'rmGridItem', 'rmButton']);

          const styleIndex = styles.findIndex(item => {
            return item.indexOf(className) !== -1
          })
          if (styleIndex !== -1) {
            styleImports.push(`@import '~common/css/common.scss';`)
            styles[styleIndex] = `
            .${className} {
          
              ::v-deep {
                .van-popup {
                  background-color: #F2F2F2;
                  padding: 15px;
                  box-sizing: border-box;
            
                  .${className}-cell {
                    margin-bottom: 55px;
                    max-height: 360px;
                    overflow-y: auto;
            
                    .${className}-cell-title {
                      font-size: 14px;
                      color: #334455;
                      margin-bottom: 15px;
                      margin-top: 6px;
                    }
            
                    .van-grid-item {
                      height: 35px;
                      margin-bottom: 9px;
            
                      .van-grid-item__content {
                        padding: 0px;
            
                        .grid-item-content {
                          font-size: 12px;
                          background: white;
                          color: #334455;
                          height: 35px;
                          border:1px solid #D8D8E1;
                          display: flex;
                          align-items: center;
                          justify-content: center;
                        }
            
                        .grid-item-content-checked {
                          font-size: 12px;
                          background: $theme-color;
                          height: 35px;
                          color: white;
                          border:1px solid $theme-color;
                          display: flex;
                          align-items: center;
                          justify-content: center;
                        }
                      }
                    }
                  }
                  .${className}-button {
                    .van-button {
                      height: 40px;
                    }
                  }
                }
              }`;
          }

          xml = `<rm-popup class="${className}" v-model="${classNameCamelCase}Visible" position="bottom">
            <div class="${className}-cell" v-if="types.length > 0">
              <div class="${className}-cell-title">分类</div> 
              <rm-grid :column-num="3" :center="false">
                <rm-grid-item use-slot v-for="(typeItem, index) in types" :key="index">
                  <div :class="typeItem.id === type.id ? 'grid-item-content-checked' : 'grid-item-content'" @click="typeClick(typeItem)">
                    {{ typeItem.name }}
                  </div>
                </rm-grid-item>
              </rm-grid>
            </div>
            <div class="${className}-button">
              <rm-button type="info" text="确定" size="large" @click="submitClick" />
            </div>
          </rm-popup>`
        }
        break;
      default:
        const kebabCase = schema.componentName.match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g).map(x => x.toLowerCase()).join('-');
        if (schema.children && schema.children.length) {
          xml = `<${kebabCase}${classString}${props}>${transform(schema.children)}</${kebabCase}>`;
        } else {
          xml = `<${kebabCase}${classString}${props} />`;
        }
    }

    if (schema.loop) {
      xml = parseLoop(schema.loop, schema.loopArgs, xml);
    }
    if (schema.condition) {
      xml = parseCondition(schema.condition, xml);
      // console.log(xml);
    }

    if (className) {
      styles.push(`}`);
    }

    return xml || '';
  };

  // parse schema
  const transform = (schema) => {
    let result = '';

    if (Array.isArray(schema) && schema.length > 0) {
      schema.forEach(layer => {
        result += transform(layer);
      });
    } else {
      const type = schema.componentName.toLowerCase();

      if (['page'].indexOf(type) !== -1) {
        const init = [];

        if (schema.state) {
          datas.push(`${toString(schema.state).slice(1, -1)}`);
        }

        if (schema.methods) {
          Object.keys(schema.methods).forEach((name) => {
            const { params, content } = parseFunction(schema.methods[name]);
            methods.push(`${name}(${params}) {${content}}`);
          });
        }

        if (schema.dataSource && Array.isArray(schema.dataSource.list)) {
          schema.dataSource.list.forEach((item) => {
            if (typeof item.isInit === 'boolean' && item.isInit) {
              init.push(`this.${item.id}();`);
            } else if (typeof item.isInit === 'string') {
              init.push(`if (${parseProps(item.isInit)}) { this.${item.id}(); }`);
            }
            methods.push(parseDataSource(item));
          });

          if (schema.dataSource.dataHandler) {
            const { params, content } = parseFunction(schema.dataSource.dataHandler);
            methods.push(`dataHandler(${params}) {${content}}`);
            init.push(`this.dataHandler()`);
          }
        }

        // if (schema.lifeCycles) {}

        template.push(generateRender(schema));
      } else {
        result += generateRender(schema);
      }
    }
    return result;
  };

  if (option.utils) {
    Object.keys(option.utils).forEach((name) => {
      utils.push(`const ${name} = ${option.utils[name]}`);
    });
  }

  transform(rootSchema);

  const prettierOpt = {
    parser: 'vue',
    singleQuote: true,
    semi: false
  };

  const mergeImports = {};
  if (imports.length > 0) {
    imports.forEach(item => {
      if (mergeImports[item.name] === undefined) {
        mergeImports[item.name] = item.value;
      } else {
        mergeImports[item.name].push(...item.value);
      }
    });
  }
  const parseImports = [];
  Object.keys(mergeImports).forEach(key => {
    parseImports.push(`import { ${mergeImports[key]} } from '${key}'`)
  });

  return {
    noTemplate: true,
    panelDisplay: [
      {
        panelName: `index.vue`,
        panelValue: prettier.format(
          `
          <template>
              ${template.join('\n\n')}
          </template>

          <script>
            ${parseImports.join('\n')}

            export default {
              components: {
                ${components.join(',\n')}
              },
              data () {
                return {
                  ${datas.join(',\n')}
                } 
              },${lifeCycles.join(',\n')}${lifeCycles.length > 0 ? ',' : ''}
              methods: {
                ${methods.join(',\n')}
              }
            }
          </script>

          <style lang="scss" scoped>
            ${styleImports.join('\n')}

            ${prettier.format(styles.join('\n'), { parser: 'scss' })}
          </style>
        `,
          prettierOpt
        ),
        panelType: 'vue'
      },
      {
        panelName: 'index.rem.css',
        panelValue: prettier.format(styles4rem.join('\n'), { parser: 'css' }),
        panelType: 'css'
      }
    ]
  };
};
